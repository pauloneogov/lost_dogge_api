import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";
import "../helpers/bigInt.js";
import { pets, pet_images, Prisma } from "@prisma/client";

enum PetStatus {
  REGISTERED = 0,
  LOST = 1,
  FOUND = 2,
  COMPLETE = 3,
}

const orderByMapper: Record<string, string> = {
  created_at: "public.pets.created_at",
  distance: "distance",
};

export function petRoutes(fastify: FastifyInstance) {
  const vermontBurlingtonGeo = {
    lon: 44.4759,
    lat: -73.2121,
  };

  fastify.get(
    "/api/v1/pets/latest-activity",
    async (request: FastifyRequest, reply: FastifyReply) => {
      let { limit = 1 } = request.query as {
        limit: number;
      };

      try {
        let pets = await prisma.$queryRaw`
        SELECT public.pets.name, public.pets.address, public.pets.status, public.pets.description,
        json_agg(
          json_build_object(
              'url', public.pet_images.url
          )
        ) as pet_images,
        json_build_object(
            'animal_type_id', public.animal_breeds.animal_type_id,
            'animal_type', json_build_object(
                'name', public.animal_types.name
            )
        ) as breed
        FROM public.pets 
        INNER JOIN public.animal_breeds ON public.animal_breeds.id = public.pets.breed_id
        LEFT JOIN public.animal_types ON public.animal_types.id = public.animal_breeds.animal_type_id
        LEFT JOIN public.pet_images ON public.pet_images.pet_id = public.pets.id
        GROUP BY public.pets.id, public.animal_breeds.id, public.animal_types.id, public.pet_images.id
        ORDER BY RANDOM()
        LIMIT ${Number(limit)}
        `;

        reply.send({
          pets,
        });
      } catch (error) {
        reply.status(400).send(error);
      }
    }
  );

  fastify.get(
    "/api/v1/pets",
    async (request: FastifyRequest, reply: FastifyReply) => {
      let ipData;
      try {
        // @ts-ignore
        ipData = await fastify.axios.get(
          "http://ip-api.com/json/132.198.39.21"
        );
      } catch (error) {
        throw error;
      }

      const { lon: ipLongitude, lat: ipLatitude } = ipData?.data;

      let {
        longitude = parseFloat(ipLatitude) || vermontBurlingtonGeo.lon,
        latitude = parseFloat(ipLongitude) || vermontBurlingtonGeo.lat,
        status = 1,
        radius = 10000,
        skip = 1,
        limit = 10,
        breed_ids = [],
        animal_type_id = undefined,
        gender = undefined,
        direction = "desc",
        order_by = "distance",
      } = request.query as {
        longitude: number;
        latitude: number;
        radius: number;
        status: number | undefined;
        skip: number;
        breed_ids: Array<BigInt>;
        animal_type_id: number;
        gender: number;
        order_by: string;
        limit: number;
        direction: string;
      };

      const statusQuery = Prisma.sql`AND public.pets.status = ${status}::int`;

      const breedsQuery = breed_ids.length
        ? Prisma.sql`AND public.animal_breeds.id = ANY(${breed_ids}::int[])`
        : Prisma.sql``;

      const animalTypesQuery = animal_type_id
        ? Prisma.sql`AND public.animal_breeds.animal_type_id = ${animal_type_id}::int`
        : Prisma.sql``;

      const genderQuery = gender
        ? Prisma.sql`AND public.pets.gender = ${gender}::int`
        : Prisma.sql``;

      const orderByWithDirection = `${orderByMapper[order_by]} ${direction}`;

      const orderByQuery = order_by
        ? Prisma.sql`ORDER BY ${orderByWithDirection}`
        : Prisma.sql``;

      let pets: any = await prisma.$queryRaw`
        SELECT *,
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
        ST_Distance(ST_MakePoint(${Number(longitude)}, ${Number(
        latitude
      )})::geography,
        ST_MakePoint(public.pets.longitude, public.pets.latitude)::geography, true) AS distance
        FROM public.pets 
        INNER JOIN public.animal_breeds ON public.animal_breeds.id = public.pets.breed_id
        ${breedsQuery}
        ${animalTypesQuery}
        ${statusQuery}
        ${genderQuery}
        LEFT JOIN public.animal_types ON public.animal_types.id = public.animal_breeds.animal_type_id
        LEFT JOIN public.pet_images ON public.pet_images.pet_id = public.pets.id
        WHERE ST_DWithin(
            ST_MakePoint(${longitude}, ${latitude})::geography,
            ST_MakePoint(public.pets.longitude, public.pets.latitude)::geography,
            ${Number(radius)}
        )
        GROUP BY public.pets.id, public.animal_breeds.id, public.animal_types.id, public.pet_images.id
        ${orderByQuery}
        LIMIT ${Number(limit)}
        OFFSET (${Number(skip)} -1) * ${Number(limit)}
        `;

      reply.send({
        pets,
      });
    }
  );
  // TODO: RUN AS A QUEUE
  fastify.get("/api/v1/found-pet-matches", async (_, reply: FastifyReply) => {
    // GET THE FOUND PET IMAGE
    const petImageId: number = 68025;
    const petImage = await prisma.pet_images.findUnique({
      where: {
        id: petImageId,
      },
      include: {
        pets: true,
        ai_pet_breeds: {
          include: {
            animal_breeds: true,
          },
        },
      },
    });

    if (!petImage) throw Error("No pet image found");

    const sanitizedPetImage = JSON.parse(JSON.stringify(petImage));

    // // GET ALL PET MATCHES THAT IS RELATED TO FOUND PET AND LOST PET
    const petMatches = await prisma.pet_matches.findMany({
      where: {
        found_pet_id: sanitizedPetImage?.pet_id,
      },
      include: {
        pets_pet_matches_found_pet_idTopets: true,
        pets_pet_matches_lost_pet_idTopets: true,
      },
    });

    const lostIdPetMatchesByFoundId =
      petMatches?.map((petMatch) => petMatch.lost_pet_id) || [];

    const breedIds =
      sanitizedPetImage?.ai_pet_breeds?.map((breed: any) =>
        Number(breed.breed_id)
      ) || [];

    // // GET ALL LOST PETS IMAGES
    const status = PetStatus.LOST;
    const longitude = sanitizedPetImage.pets.longitude;
    const latitude = sanitizedPetImage.pets.latitude;
    const orderBy = "distance";
    const direction = "DESC";
    const radius = 10000;

    const statusQuery = Prisma.sql`AND public.pets.status = ${status}`;

    const breedsQuery = breedIds.length
      ? Prisma.sql`AND public.animal_breeds.id = ANY(${breedIds}::int[])`
      : Prisma.sql``;

    const petsIdQuery =
      lostIdPetMatchesByFoundId.length > 0
        ? Prisma.sql`AND NOT public.pets.id = ANY(${lostIdPetMatchesByFoundId}::uuid[])`
        : Prisma.sql``;

    const orderByWithDirection = `${orderByMapper[orderBy]} ${direction}`;

    const orderByQuery = orderBy
      ? Prisma.sql`ORDER BY ${orderByWithDirection}`
      : Prisma.sql``;

    // // GET ALL PETS THAT ARE LOST BASED ON FOUND PET IMAGE MATCHES
    let pets: any = await prisma.$queryRaw`
        SELECT *, public.pets.id,
        ST_Distance(ST_MakePoint(${longitude}, ${latitude})::geography,
        ST_MakePoint(public.pets.longitude, public.pets.latitude)::geography, true) AS distance
        FROM public.pets
        INNER JOIN public.animal_breeds ON public.animal_breeds.id = public.pets.breed_id
        ${statusQuery}
        ${petsIdQuery}
        ${breedsQuery}
        WHERE ST_DWithin(
            ST_MakePoint(${longitude}, ${latitude})::geography,
            ST_MakePoint(public.pets.longitude, public.pets.latitude)::geography,
            ${Number(radius)}
        )
        ${orderByQuery}
        `;

    if (!pets.length) throw Error("No pet matches found");

    const createMatchedPetImagesPayload =
      pets?.map((pet: pets & { distance: string }) => {
        return {
          match_percentage: 100.0,
          distance: pet.distance,
          found_pet_id: sanitizedPetImage.pet_id,
          lost_pet_id: pet.id,
        };
      }) || [];

    const createdPetImages = await prisma.pet_matches.createMany({
      data: createMatchedPetImagesPayload,
    });

    reply.send({
      createdPetImages,
    });
  });

  fastify.get("/api/v1/lost-pet-matches", async (_, reply: FastifyReply) => {
    const petId: string = "c21a0430-d446-48ea-8287-e4fc8b150069";

    const pet: pets | null = await prisma.pets.findUnique({
      where: {
        id: petId,
      },
    });

    if (!pet) throw Error("No pet found");

    // GET ALL PET MATCHES THAT IS RELATED TO FOUND PET AND LOST PET
    const petMatches = await prisma.pet_matches.findMany({
      where: {
        lost_pet_id: pet.id,
      },
    });

    const foundIdPetMatchesByLostIds =
      petMatches?.map((petMatch: any) => petMatch.lost_pet_id) || [];

    console.log("🚀 ~ file: pets.ts ~ line 233 ~ fastify.get ~ pet", pet);

    const status = PetStatus.FOUND;
    const longitude = pet.longitude;
    const latitude = pet.latitude;
    const breedIds = [pet.breed_id];
    const orderBy = "distance";
    const direction = "DESC";
    const radius = 10000;

    const statusQuery = Prisma.sql`AND public.pets.status = ${status}`;

    const petsIdQuery =
      foundIdPetMatchesByLostIds.length > 0
        ? Prisma.sql`AND NOT public.pets.id = ANY(${foundIdPetMatchesByLostIds}::uuid[])`
        : Prisma.sql``;

    const breedsQuery = breedIds.length
      ? Prisma.sql`AND public.animal_breeds.id = ANY(${breedIds}::int[])`
      : Prisma.sql``;

    const orderByWithDirection = `${orderByMapper[orderBy]} ${direction}`;

    const orderByQuery = orderBy
      ? Prisma.sql`ORDER BY ${orderByWithDirection}`
      : Prisma.sql``;

    let pets: any = await prisma.$queryRaw`
    SELECT *, public.pets.id,
    ST_Distance(ST_MakePoint(${longitude}, ${latitude})::geography,
    ST_MakePoint(public.pets.longitude, public.pets.latitude)::geography, true) AS distance
    FROM public.pets
    INNER JOIN public.animal_breeds ON public.animal_breeds.id = public.pets.breed_id
    ${statusQuery}
    ${petsIdQuery}
    WHERE ST_DWithin(
        ST_MakePoint(${longitude}, ${latitude})::geography,
        ST_MakePoint(public.pets.longitude, public.pets.latitude)::geography,
        ${Number(radius)}
    )
    ${orderByQuery}
    `;

    const createMatchedPetImagesPayload =
      pets?.map((_pet: pets & { distance: string }) => {
        return {
          match_percentage: 100.0,
          distance: _pet.distance,
          found_pet_id: pet.id,
          lost_pet_id: _pet.id,
        };
      }) || [];

    // const createdPetImages = await prisma.pet_matches.createMany({
    //   data: createMatchedPetImagesPayload,
    // });

    reply.send({
      pets,
    });
  });

  enum PetMatchPossibleType {
    PENDING = 0,
    MATCH = 1,
    POSSIBLE = 2,
    NO_MATCH = 3,
  }

  enum PetMatchPossibleTypeMessage {
    MATCH = "Hi, I think you found my pet",
    POSSIBLE = "Hi, this looks like a possible match",
  }

  fastify.put(
    "/api/v1/pet-match",
    async (request: FastifyRequest, reply: FastifyReply) => {
      let { id, type } = request.query as {
        id: string;
        type: number;
      };

      await prisma.pet_matches.update({
        where: {
          id,
        },
        data: {
          type,
        },
      });

      let data = await prisma.pet_matches.findFirst({
        where: {
          id,
        },
      });

      // TODO: Send message to founder depending on the type set
      await prisma.messages.create({
        data: {
          pet_match_id: id,
          lost_pet_id: data?.lost_pet_id,
          found_pet_id: data?.found_pet_id,
        },
      });
    }
  );
}
