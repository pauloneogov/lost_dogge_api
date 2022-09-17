import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";
import '../helpers/bigInt.js'

enum PetStatus {
    LOST= 0,
    FOUND = 1,
}

export function petRoutes(fastify: FastifyInstance) {
    fastify.get("/api/v1/pets",
    async (request:FastifyRequest, reply: FastifyReply) => {
        let { longitude, latitude, locationText, status = 0, skip = 0, limit = 100 } = request.params as {
            longitude: number,
            latitude: number,
            locationText: string | undefined,
            status: PetStatus | undefined,
            skip: number,
            limit: number
        }

        // let pets = await prisma.pets.findMany({
        //     skip,
        //     take: limit,
        //     include: {
        //         pet_images: true,
        //         lost_meta: true
        //     },
        //     where: {
        //         status
        //     }
        // })

        let test: any = await prisma.$queryRaw`
        SELECT 
        json_build_object(
            'id', public.pets.id,
            'created_at', public.pets.created_at,
            'name', public.pets.name,
            'description', public.pets.description,
            'weight', public.pets.weight,
            'height', public.pets.height,
            'gender', public.pets.gender,
            'breed_id', public.pets.breed_id,
            'is_vaccinated', public.pets.is_vaccinated,
            'status', public.pets.is_vaccinated,
            'contact_number', public.pets.contact_number,
            'email', public.pets.email,
            'instagram', public.pets.instagram,
            'facebook', public.pets.facebook,
            'twitter', public.pets.twitter,
            'breed', json_build_object(
                'id', public.animal_breeds.id,
                'name', public.animal_breeds.name,
                'type', public.animal_types.name
            ),
            'lost_meta', json_agg(
                json_build_object(
                    'lost_date', public.lost_meta.lost_date,
                    'found_date', public.lost_meta.found_date,
                    'longitude', public.lost_meta.longitude,
                    'latitude', public.lost_meta.latitude
                )
            ),
            'pet_images', json_agg(
                json_build_object(
                    'url', public.pet_images.url
                )
            )
        )
        FROM public.pets
        INNER JOIN public.lost_meta ON public.lost_meta.pet_id = public.pets.id
        INNER JOIN public.pet_images ON public.pet_images.pet_id = public.pets.id
        INNER JOIN public.animal_breeds ON public.animal_breeds.id = public.pets.breed_id
        INNER JOIN public.animal_types ON public.animal_types.id = public.animal_breeds.animal_type_id
        WHERE is_deleted = false
        GROUP BY public.pets.id, public.animal_breeds.id, public.animal_types.id
        OFFSET ${skip}
        LIMIT ${limit}
        `
        // console.log(pets[0])
        console.log(test[0])


        reply.send({
            test
        });



    }
    )
}
