import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { petRoutes } from "./controllers/pets";
import { stripeRoutes } from "./controllers/stripe";
import { fbAdRoutes } from "./controllers/fbAds";
import { hookRoutes } from "./controllers/hooks";

export function registerRoutes(fastify: FastifyInstance) {
  petRoutes(fastify);
  stripeRoutes(fastify);
  fbAdRoutes(fastify);
  hookRoutes(fastify);
}
