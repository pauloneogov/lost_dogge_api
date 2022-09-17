import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { petRoutes } from "./controllers/pets";

export function registerRoutes(fastify: FastifyInstance) {
  petRoutes(fastify);
}
