// @ts-nocheck
import { FastifyReply } from "fastify";
import { FastifyInstance, FastifyRequest } from "fastify";
import Stripe from "stripe";
import { prisma } from "../prisma";
import "../helpers/bigInt.js";
import { logger } from "../main";

export function stripeRoutes(fastify: FastifyInstance) {
  const stripeEndpoint = fastify?.config.STRIPE_WEBHOOK;
  const stripeClient = new Stripe(fastify?.config.STRIPE_SECRET, {
    apiVersion: "2022-11-15",
  });

  type checkoutSessionRequestType = {
    price_id: string;
    quantity: number;
    success_url: string;
    cancel_url: string;
    pet_id: string;
    user_id: string;
  };

  fastify.post(
    "/api/v1/checkout-session",
    async (request: FastifyRequest, reply: FastifyReply) => {
      let { price_id, pet_id, user_id, success_url, cancel_url } =
        request.body as checkoutSessionRequestType;

      let payment = await getFirstPaymentSuccess(pet_id);
      if (payment) {
        return reply
          .status(400)
          .send({ message: "Payment has been made already" });
      }

      let paymentResponse = null;

      let stripeProduct = await prisma.stripe_products.findFirst({
        where: {
          stripe_price_id: price_id,
        },
      });

      if (!stripeProduct)
        return reply.status(400).send({ message: "No stripe product found" });

      try {
        paymentResponse = await prisma.payments.create({
          data: {
            pet_id,
            quantity: 1,
            stripe_product_id: stripeProduct?.id,
          },
        });
      } catch (error) {
        request.log.error({ type: "stripe-webhook", data: error });
        return reply.status(500).send({ message: "Unexpected error" });
      }

      let user = await prisma.users.findUnique({
        where: {
          id: user_id,
        },
      });

      console.log(success_url);

      try {
        const session = await stripeClient.checkout.sessions.create({
          line_items: [
            {
              price: price_id,
              quantity: stripeProduct.quantity,
            },
          ],
          automatic_tax: {
            enabled: true,
          },
          payment_intent_data: {
            metadata: {
              client_reference_id: paymentResponse?.id,
              user_id: user?.id,
            },
          },
          client_reference_id: paymentResponse?.id,
          customer_email: user?.email!,
          mode: "payment",
          custom_text: {
            submit: {
              message: `Daily Ads`,
            },
          },
          metadata: {
            client_reference_id: stripeProduct?.id,
            user_id: user?.id,
          },
          success_url: `${success_url}/payment/${paymentResponse.id}/process?pet_id=${pet_id}`,
          cancel_url: `${cancel_url}/payment/${paymentResponse.id}/process?pet_id=${pet_id}`,
        });

        return reply.send({ stripe_url: session.url });
      } catch (error) {
        return reply.status(500).send(error);
      }
    }
  );

  fastify.post(
    "/api/v1/stripe-hook",
    async (request: FastifyRequest, reply: FastifyReply) => {
      let event = request.body;

      if (stripeEndpoint) {
        const signature = request.headers["stripe-signature"];

        try {
          event = stripeClient.webhooks.constructEvent(
            request.rawBody,
            signature,
            stripeEndpoint
          );
        } catch (err) {
          request.log.error({ type: "stripe-webhook", data: err });
          console.log(`⚠️  Webhook signature verification failed.`, err);
          return reply.status(400);
        }
      }

      const paymentIntent = event?.data.object;

      switch (event?.type) {
        case "payment_intent.succeeded":
          // Then define and call a method to handle the successful payment intent.
          await handlePaymentIntentSucceeded(paymentIntent);
          break;
        case "checkout.session.expired":
          await handlePaymentIntentFailed(paymentIntent);
        case "payment_intent.payment_failed":
          // Then define and call a method to handle the successful attachment of a PaymentMethod.
          await handlePaymentIntentFailed(paymentMethod);
          break;
        default:
          // Unexpected event type
          console.log(`Unhandled event type ${event.type}.`);
          request.log.error({ type: "stripe-webhook", data: event });
      }

      return reply.send("success");
    }
  );

  const handlePaymentIntentSucceeded = async (paymentIntent) => {
    logger.info({ type: "paymentIntent", data: paymentIntent });
    // CHECK IF THE PAYMENT INTENT status key is success or failed
    try {
      await prisma.payments.update({
        where: {
          id: paymentIntent?.metadata?.client_reference_id,
        },
        data: {
          status: 1,
          stripe_payment_intent_id: paymentIntent?.id,
          receipt_url: paymentIntent?.charges?.data[0].receipt_url,
        },
      });
    } catch (error) {
      logger.error({ type: "paymentIntent", data: error });
    }
  };

  const handlePaymentIntentFailed = async (paymentIntent) => {
    const paymentIntentId =
      paymentIntent.payment_intent || paymentIntent.id || "";
    if (paymentIntentId) {
      await prisma.payments.update({
        where: {
          id: paymentIntent?.metadata?.client_reference_id,
        },
        data: {
          status: 2,
          stripe_payment_intent_id: paymentIntentId,
        },
      });
    }
  };

  const getFirstPaymentSuccess = async (petId: string) => {
    const payment = await prisma.payments.findFirst({
      where: {
        pet_id: petId,
        status: 1,
      },
    });

    return payment;
  };
}
