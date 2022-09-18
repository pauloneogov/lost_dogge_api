import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../prisma";
import '../helpers/bigInt.js'

enum PetStatus {
    LOST= 0,
    FOUND = 1,
}

export function petRoutes(fastify: FastifyInstance) {
    const vermontBurlingtonGeo = {
        lon: 44.4759,
        lat: 73.2121
    }

    fastify.get("/api/v1/pets",
    async (request:FastifyRequest, reply: FastifyReply) => {
        let ipData
        try {
            // @ts-ignore
            ipData = await fastify.axios.get('http://ip-api.com/json/24.48.0.1')
        } catch (error) {
            console.log(error)
        }
        const { lon: ipLongitude, lat: ipLatitude} = ipData?.data

        let { longitude = ipLatitude || vermontBurlingtonGeo.lon, latitude = ipLongitude || vermontBurlingtonGeo.lat, status = 0, radius = 50, skip = 0, limit = 100 } = request.params as {
            longitude: number,
            latitude: number,
            radius: number,
            status: PetStatus | undefined,
            skip: number,
            limit: number,
        }

        let pets: any = await prisma.$queryRaw`
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
            'distance', SQRT(
                POW(69.1 * (public.pets.latitude - ${longitude}), 2) +
                POW(69.1 * (${latitude} - public.pets.longitude) * COS(public.pets.latitude / 57.3), 2)),
            'breed', json_build_object(
                'id', public.animal_breeds.id,
                'name', public.animal_breeds.name,
                'type', public.animal_types.name
            ),
            'pet_images', json_agg(
                json_build_object(
                    'url', public.pet_images.url
                )
            )
        )
        
        FROM public.pets
        INNER JOIN public.pet_images ON public.pet_images.pet_id = public.pets.id
        INNER JOIN public.animal_breeds ON public.animal_breeds.id = public.pets.breed_id
        INNER JOIN public.animal_types ON public.animal_types.id = public.animal_breeds.animal_type_id
        WHERE is_deleted = false AND status = ${status}
        GROUP BY public.pets.id, public.animal_breeds.id, public.animal_types.id
        OFFSET ${skip}
        LIMIT ${limit}
        `


        console.log(pets[0])


        reply.send({
            pets
        });



    }
    )
}
