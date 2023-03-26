// @ts-nocheck
import "../helpers/bigInt.js";
import { FastifyReply } from "fastify";
import { FastifyInstance, FastifyRequest } from "fastify";
// @ts-ignore
import { slack } from "../main";

export function hookRoutes(fastify: FastifyInstance) {
  fastify.post("/api/v1/hook/create-pet", async (request: FastifyRequest) => {
    let event = request.body;
    // @ts-ignore
    slack.alert({
      channel: "#notify",
      text: `Pet created: ${JSON.stringify(event)}`,
    });
    if (event?.type == "INSERT") {
      if (event.record.status == 1 || event.record.status == 2) {
        // Send email to user
      }
    }
  });

  fastify.post("/api/v1/hook/payment-cu", async (request: FastifyRequest) => {
    let event = request.body;
    // @ts-ignore
    slack.alert({
      channel: "#notify",
      text: `Payment created/updated: ${JSON.stringify(event)}`,
    });
    if (event?.type == "UPDATE") {
      if (event?.record?.receipt_url) {
        // Send email to payment receipt and tell them its successful
      }
    }
  });

  fastify.post("/api/v1/hook/fbadsets-cu", async (request: FastifyRequest) => {
    let event = request.body;
    // @ts-ignore

    if (event?.type == "CREATE") {
      if (event?.record?.status === "PENDING REVIEW") {
        slack.alert({
          channel: "#notify",
          text: `Fbadsets created/updated: ${JSON.stringify(event)}`,
        });
        // Send email saying its pending review
      }
    }
    if (event?.type == "UPDATE") {
      if (event?.record?.status === "FAILED") {
        slack.alert({
          channel: "#notify",
          text: `Fbadsets created/updated: ${JSON.stringify(event)}`,
        });
        // Send email saying its failed
      }
      if (event?.record?.status === "IN_PROGRESS") {
        // Send email saying its failed
      }
    }
  });

  // const sendFoundPetEmail = (payload) => {};

  // const sendLostPetEmail = (payload) => {};

  //   {
  //     type: 'INSERT',
  //     table: 'pets',
  //     record: {
  //       id: '00379472-368c-4f60-8acf-467522c1945b',
  //       name: 'test',
  //       email: 'test@gmail.com',
  //       gender: 0,
  //       height: 10,
  //       status: 0,
  //       weight: 30,
  //       address: null,
  //       twitter: '',
  //       user_id: '54e0ecf1-6f25-415a-ae40-3efa8c5a3bab',
  //       breed_id: null,
  //       facebook: '',
  //       latitude: null,
  //       instagram: '',
  //       longitude: null,
  //       lost_date: null,
  //       created_at: '2023-02-11T15:10:23.160316+00:00',
  //       found_date: null,
  //       is_deleted: null,
  //       description: 'test',
  //       is_vaccinated: true,
  //       animal_type_id: 89,
  //       contact_number: '317-797-9869'
  //     },
  //     schema: 'public',
  //     old_record: null
  //   }
}
