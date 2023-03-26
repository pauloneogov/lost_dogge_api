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
      text: `Pet created: ${event}`,
    });
  });

  fastify.post("/api/v1/hook/payment-cu", async (request: FastifyRequest) => {
    let event = request.body;
    // @ts-ignore
    slack.alert({
      channel: "#notify",
      text: `Payment created/updated: ${event}`,
    });
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
