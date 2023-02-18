import "dotenv/config";
import Fastify, { fastify } from "fastify";
import cors from "@fastify/cors";
import { randomBytes } from "crypto";
import { registerRoutes } from "./routes";
import { prisma } from "./prisma";
import fastifyEnv from "@fastify/env";
const { fastifySchedulePlugin } = require("@fastify/schedule");
// @ts-ignore
import axiosClient from "fastify-axios";

const main = async () => {
  const schema = {
    type: "object",
    required: [
      "STRIPE_SECRET",
      "STRIPE_WEBHOOK",
      "FACEBOOK_APP_ID",
      "FACEBOOK_ACCESS_TOKEN",
      "FACEBOOK_ACCESS_SECRET",
      "FACEBOOK_AD_ACCOUNT_ID",
      "FACEBOOK_PAGE_ID",
    ],
    properties: {
      STRIPE_SECRET: {
        type: "string",
      },
      STRIPE_WEBHOOK: {
        type: "string",
      },
      FACEBOOK_APP_ID: {
        type: "string",
      },
      FACEBOOK_ACCESS_TOKEN: {
        type: "string",
      },
      FACEBOOK_ACCESS_SECRET: {
        type: "string",
      },
      FACEBOOK_AD_ACCOUNT_ID: {
        type: "string",
      },
      FACEBOOK_PAGE_ID: {
        type: "string",
      },
    },
  };

  const server = Fastify({
    genReqId: () => randomBytes(8).toString("hex"),
    logger: true,
  });

  server.register(fastifySchedulePlugin);

  server.register(fastifyEnv, {
    dotenv: true, // will read .env in root folder
    confKey: "config",
    data: process.env,
    schema,
  });

  server.register(import("fastify-raw-body"), {
    field: "rawBody", // change the default request.rawBody property name
    global: true, // add the rawBody to every request. **Default true**
    encoding: false, // set it to false to set rawBody as a Buffer **Default utf8**
    runFirst: true, // get the body before any preParsing hook change/uncompress it. **Default false**
    // routes: [], // array of routes, **`global`** will be ignored, wildcard routes not supported
  });

  await server.after();

  server.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  });

  server.register(require("@fastify/multipart"));
  server.register(require("@fastify/formbody"));

  server.register(axiosClient, {
    name: "axios",
  });

  server.register(require("fastify-qs"), {});

  // connect to database
  await prisma.$connect();
  server.log.info("Connected to Prisma");

  // register all routes
  registerRoutes(server);

  try {
    // @ts-ignore
    await server.listen({ port: process.env.PORT || 8080, host: "0.0.0.0" });
    // await server.listen({
    //   port: process.env.PORT || 8080,
    // });
  } catch (err) {
    // server.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
};
main();
