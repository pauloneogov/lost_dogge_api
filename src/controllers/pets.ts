import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";
import { pets } from "@prisma/client";

enum PetStatus {
    LOST= 0,
    FOUND = 1,
}

export function petRoutes(fastify: FastifyInstance) {
    fastify.get("/api/v1/pets",
    async (request:FastifyRequest, reply: FastifyReply) => {
        let { longitude, latitude, locationText, status, cursor = 0, limit = 100 } = request.params as {
            longitude: number,
            latitude: number,
            locationText: string | undefined,
            status: PetStatus | undefined,
            cursor: number,
            limit: number

        }

        await prisma.pets.findMany({
            skip: cursor,
            take: limit,
            where: {
                status,
            }
            
        })

    }
    )

  fastify.post(
    "/api/v1/auth/register",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            email: { type: "string" },
            password: { type: "string" },
          },
          required: ["email", "password"],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      let { email, password } = request.body as {
        email: string;
        password: string;
      };

      let record = await prisma.user.findUnique({
        where: { email },
      });

      if (record) {
        reply.code(400).send({
          message: "Email already exists",
        });
      }

      let user = await prisma.user.create({
        data: {
          email,
          role: Role.USER,
        },
      });

      const salt = pbkdf2Sync(
        password,
        new Date().toISOString(),
        1000,
        64,
        `sha512`
      ).toString(`hex`);

      var hash = pbkdf2Sync(password, salt, 1000, 64, `sha512`).toString(`hex`);

      await prisma.auth.create({
        data: {
          userId: user.id,
          salt,
          hash,
        },
      });

      let token = jwt.sign(
        { id: record!.id, email: record!.email, role: record!.role },
        process.env.JWT_SECRET ?? "",
        {
          expiresIn: "365d",
          issuer: "satishbabariya.com",
        }
      );

      reply.send({
        token,
        user: record,
      });
    }
  );

  fastify.post(
    "/api/v1/auth/login",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            email: { type: "string" },
            password: { type: "string" },
          },
          required: ["email", "password"],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      let { email, password } = request.body as {
        email: string;
        password: string;
      };

      let record = await prisma.user.findUnique({
        where: { email },
      });

      if (!record) {
        reply.code(401).send({
          message: "Invalid email or password",
        });
      }

      let auth = await prisma.auth.findFirst({
        where: {
          userId: record!.id,
        },
      });

      if (!auth) {
        reply.code(401).send({
          message: "Invalid email or password",
        });
      }

      var hash = pbkdf2Sync(password, auth!.salt, 1000, 64, `sha512`).toString(
        "hex"
      );

      if (hash !== auth!.hash) {
        reply.code(401).send({
          message: "Invalid email or password",
        });
      }

      let token = jwt.sign(
        { id: record!.id, email: record!.email, role: record!.role },
        process.env.JWT_SECRET ?? "",
        {
          expiresIn: "365d",
          issuer: "satishbabariya.com",
        }
      );

      reply.send({
        token,
        user: record,
      });
    }
  );
}
