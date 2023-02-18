import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";
const prisma = new PrismaClient({
  log: ["query"],
});
// import breedsData from './json/breed.js'
let breedsData = require("./json/breed.js");

async function main() {
  await prisma.lost_meta.deleteMany();
  await prisma.pet_images.deleteMany();
  await prisma.pets.deleteMany();
  await prisma.animal_breeds.deleteMany();
  await prisma.animal_types.deleteMany();

  await prisma.animal_types.createMany({
    data: [{ name: "Cat" }, { name: "Dog" }],
  });

  const animalTypes = await prisma.animal_types.findMany();
  console.log(animalTypes);

  const formattedBreeds = breedsData.map((_breed: any) => {
    return {
      name: humanize(_breed.breed),
      animal_type_id: animalTypes.find(
        (_animalType) => _animalType.name === _breed.species
      )?.id,
    };
  });

  await prisma.animal_breeds.createMany({
    data: formattedBreeds,
  });

  const animalBreeds = await prisma.animal_breeds.findMany();
  console.log(animalBreeds);

  let mockPets = [];

  const vermontBurlingtonGeo = {
    lon: 44.4759,
    lat: -73.2121,
  };

  for (let i = 0; i < 5000; i++) {
    mockPets.push({
      name: faker.name.firstName(),
      description: faker.lorem.paragraph(),
      weight: faker.datatype.number({ max: 20 }),
      height: faker.datatype.number({ max: 20 }),
      gender: faker.datatype.boolean() ? 1 : 0,
      breed_id:
        animalBreeds[faker.datatype.number({ max: animalBreeds.length - 1 })]
          .id,
      is_vaccinated: faker.datatype.boolean(),
      status: faker.datatype.number({ max: 2 }),
      contact_number: faker.phone.number(),
      email: faker.internet.email(),
      instagram: faker.internet.domainWord(),
      facebook: faker.internet.domainWord(),
      twitter: faker.internet.domainName(),
      is_deleted: faker.datatype.boolean(),
      lost_date: faker.date.recent(),
      longitude:
        vermontBurlingtonGeo.lon +
        faker.datatype.float({ precision: 0.0001, max: 1 }),
      latitude:
        vermontBurlingtonGeo.lat +
        faker.datatype.float({ precision: 0.0001, max: 1 }),
      // user_id:
    });
  }

  await prisma.pets.createMany({
    data: mockPets,
  });

  const pets = await prisma.pets.findMany();
  console.log(pets);

  let mockPetImages: any = [];
  for (let i = 0; i < 2; i++) {
    pets.forEach((_pet) => {
      mockPetImages.push({
        pet_id: _pet.id,
        url: faker.helpers.arrayElement([
          faker.image.animals(),
          faker.image.cats(),
          faker.image.fashion(),
          faker.image.food(),
          faker.image.city(),
        ]),
      });
    });
  }

  await prisma.pet_images.createMany({
    data: mockPetImages,
  });

  const petImages = await prisma.pet_images.findMany();
  console.log(petImages);

  let mockPetLostMeta = pets.map((pet) => {
    return {
      pet_id: pet.id,
      lost_date: faker.date.recent(),
      longitude:
        vermontBurlingtonGeo.lon +
        faker.datatype.float({ precision: 0.0001, max: 1 }),
      latitude:
        vermontBurlingtonGeo.lat +
        faker.datatype.float({ precision: 0.0001, max: 1 }),
    };
  });
  console.log(mockPetLostMeta);

  await prisma.lost_meta.createMany({
    data: mockPetLostMeta,
  });

  const lostMeta = await prisma.lost_meta.findMany();
  console.log(lostMeta);
}

function humanize(str: string) {
  let i,
    frags = str.split("_");
  for (i = 0; i < frags.length; i++) {
    frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
  }
  return frags.join(" ");
}

main();
