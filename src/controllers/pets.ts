import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";
import "../helpers/bigInt.js";
import { Prisma } from "@prisma/client";

enum PetStatus {
  LOST = 0,
  FOUND = 1,
}

const orderByMapper: Record<string, string> = {
  created_at: "public.pets.created_at",
  distance: "d",
};

export function petRoutes(fastify: FastifyInstance) {
  const vermontBurlingtonGeo = {
    lon: 44.4759,
    lat: -73.2121,
  };

  fastify.get(
    "/api/v1/pets",
    async (request: FastifyRequest, reply: FastifyReply) => {
      let ipData;
      try {
        // @ts-ignore
        ipData = await fastify.axios.get(
          "http://ip-api.com/json/132.198.39.21"
        );
        console.log(ipData);
      } catch (error) {
        throw error;
      }
      const { lon: ipLongitude, lat: ipLatitude } = ipData?.data;

      let {
        longitude = parseFloat(ipLatitude) || vermontBurlingtonGeo.lon,
        latitude = parseFloat(ipLongitude) || vermontBurlingtonGeo.lat,
        status = 0,
        radius = 10000,
        skip = 1,
        limit = 10,
        breed_ids = [],
        animal_type_id = 89,
        direction = "desc",
        order_by = "distance",
      } = request.params as {
        longitude: number;
        latitude: number;
        radius: number;
        status: PetStatus | undefined;
        skip: number;
        breed_ids: Array<BigInt>;
        animal_type_id: number;
        order_by: string;
        limit: number;
        direction: string;
      };

      const breedsQuery = breed_ids.length
        ? Prisma.sql`AND public.animal_breeds.id = ANY(${breed_ids}::int[])`
        : Prisma.sql``;

      const animalTypesQuery = animal_type_id
        ? Prisma.sql`AND public.animal_breeds.animal_type_id = ${animal_type_id}::int`
        : Prisma.sql``;

      const orderByWithDirection = `${orderByMapper[order_by]} ${direction}`;

      const orderByQuery = order_by
        ? Prisma.sql`ORDER BY ${orderByWithDirection}`
        : Prisma.sql``;

      let pets: any = await prisma.$queryRaw`
        SELECT *,
        st_distancespheroid(
          POINT(${longitude}, ${latitude})::geometry, 
          point(public.pets.longitude, public.pets.latitude)::geometry,
          'SPHEROID["WGS 84",6378137,298.257223563]'::spheroid) AS distance,
        json_agg(
          json_build_object(
              'url', public.pet_images.url
          )
        ) as pet_images,
        json_build_object(
            'id', public.animal_breeds.id,
            'name', public.animal_breeds.name,
            'animal_type_id', public.animal_breeds.animal_type_id,
            'animal_type', json_build_object(
                'name', public.animal_types.name
            )
        ) as breed,
        ST_MakePoint(public.pets.longitude, public.pets.latitude)::geography, true) AS distance
        FROM public.pets 
        INNER JOIN public.animal_breeds ON public.animal_breeds.id = public.pets.breed_id
        ${breedsQuery}
        ${animalTypesQuery}
        LEFT JOIN public.animal_types ON public.animal_types.id = public.animal_breeds.animal_type_id
        LEFT JOIN public.pet_images ON public.pet_images.pet_id = public.pets.id
        WHERE ST_DWithin(
            ST_MakePoint(${longitude}, ${latitude})::geography,
            ST_MakePoint(public.pets.longitude, public.pets.latitude)::geography,
            ${radius}
        )
        GROUP BY public.pets.id, public.animal_breeds.id, public.animal_types.id, public.pet_images.id
        ${orderByQuery}
        LIMIT ${limit}
        OFFSET (${skip} -1) * ${limit}
        `;

      reply.send({
        pets,
      });
    }
  );
}
