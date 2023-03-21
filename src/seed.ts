import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";
import { createClient } from "@supabase/supabase-js";
// @ts-ignore
import cityData from "./json/cityData.js";
// @ts-ignore
import petName from "./json/petName.js";
// @ts-ignore
// import LocalFileData from "get-file-object-from-local-path";
import { decode } from "base64-arraybuffer";

const prisma = new PrismaClient();
// import breedsData from './json/breed.js'
let breedsData = require("./json/breed.js");
// const path = require("path");
var fs = require("fs");

async function main() {
  const supabase = await createClient(
    "https://fhasuqzjmruhvugclutt.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYXN1cXpqbXJ1aHZ1Z2NsdXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NjA2ODk5ODIsImV4cCI6MTk3NjI2NTk4Mn0.SYrw1VVHMBph5TEuwG383rsCthXXs-ni6g2LXC9NCSc"
  );

  // const petsWithoutImages = await prisma.pets.findMany({
  //   where: {
  //     pet_images: { none: {} },
  //   },
  //   include: {
  //     pet_images: true,
  //   },
  // });

  // console.log(petsWithoutImages);

  // const petsWithoutImagesIds = petsWithoutImages.map((pet) => pet.id);

  // const deletedPetImages = await prisma.pet_images.deleteMany({
  //   where: {
  //     pet_id: {
  //       in: petsWithoutImagesIds,
  //     },
  //   },
  // });

  // console.log(deletedPetImages);

  // const deletedPets = await prisma.pets.deleteMany({
  //   where: {
  //     id: {
  //       in: petsWithoutImagesIds,
  //     },
  //   },
  // });
  // console.log(deletedPets);

  // await prisma.pets.deleteMany();

  const hasWhiteSpace = (s: string) => {
    return s.indexOf(" ") >= 0;
  };

  var files = fs.readdirSync(process.cwd() + "/images/pet_images");

  console.log(files);

  // // @ts-ignore
  // for (const file of files) {
  //   const contents = fs.readFileSync(process.cwd() + "/images/" + file, {
  //     encoding: "base64",
  //   });

  //   const petPath = `public/${file}`;

  //   const { data: uploadData, error: uploadError } = await supabase.storage
  //     .from("pets")
  //     .upload(petPath, decode(contents), {
  //       cacheControl: "3600",
  //       contentType: "image/jpg",
  //     });

  //   console.log(uploadData, uploadError);
  // }

  // await prisma.lost_meta.deleteMany();
  // await prisma.pet_images.deleteMany();
  // await prisma.pets.deleteMany();

  // await prisma.animal_breeds.deleteMany();
  // await prisma.animal_types.deleteMany();

  // @ts-ignore
  // let hasData = true;

  // while (hasData) {
  //   // @ts-ignore
  //   const { data: petImages } = await supabase.storage
  //     .from("pets")
  //     .list("public", {
  //       limit: 1000,
  //       offset: allPetImages.length || 0,
  //     });
  //   allPetImages.push(petImages);
  //   console.log(petImages[petImages.length - 1]);
  //   console.log(allPetImages.length);
  //   if (petImages?.length === 0) {
  //     hasData = false;
  //   }
  // }

  // console.log(allPetImages);

  const catImages = files?.filter(
    // @ts-ignore
    (pet) => pet.includes("cat") && !hasWhiteSpace(pet)
  );
  const dogImages = files?.filter(
    // @ts-ignore
    (pet) => pet.includes("dog") && !hasWhiteSpace(pet)
  );

  console.log(catImages?.length);
  console.log(dogImages?.length);

  // @ts-ignore
  let mockPets = [];

  const petNames = [...new Set(petName)];

  const animalBreeds = await prisma.animal_breeds.findMany();

  const animalTypes = await prisma.animal_types.findMany();
  console.log(animalTypes);

  // console.log(cityData);

  const vermontBurlingtonGeo = {
    lon: 44.4759,
    lat: -73.2121,
  };

  // @ts-ignore
  cityData.forEach((city) => {
    for (let i = 0; i < 5; i++) {
      mockPets.push({
        name: petNames[faker.datatype.number({ max: petNames.length - 1 })],
        //     description: faker.lorem.paragraph(),
        weight: faker.datatype.number({ max: 20 }),
        height: faker.datatype.number({ max: 20 }),
        gender: faker.datatype.boolean() ? 1 : 0,
        breed_id:
          animalBreeds[faker.datatype.number({ max: animalBreeds.length - 1 })]
            .id,
        animal_type_id:
          animalTypes[faker.datatype.number({ max: animalTypes.length - 1 })]
            ?.id,
        is_vaccinated: faker.datatype.boolean(),
        status: faker.datatype.number({ max: 2 }),
        contact_number: faker.phone.number(),
        email: faker.internet.email(),
        // instagram: faker.internet.domainWord(),
        // facebook: faker.internet.domainWord(),
        //     twitter: faker.internet.domainName(),
        is_deleted: false,
        is_mine: true,
        lost_date: faker.date.recent(),
        longitude:
          vermontBurlingtonGeo.lon +
          faker.datatype.float({ precision: 0.001, max: 3, min: -3 }),
        latitude:
          vermontBurlingtonGeo.lat +
          faker.datatype.float({ precision: 0.001, max: 3, min: -3 }),
      });
    }
  });

  // @ts-ignore
  console.log(mockPets);

  // await prisma.animal_types.createMany({
  //   data: [{ name: "Cat" }, { name: "Dog" }],
  // });

  // console.log(animalTypes);

  // const formattedBreeds = breedsData.map((_breed: any) => {
  //   return {
  //     name: humanize(_breed.breed),
  //     animal_type_id: animalTypes.find(
  //       (_animalType) => _animalType.name === _breed.species
  //     )?.id,
  //   };
  // });

  // await prisma.animal_breeds.createMany({
  //   data: formattedBreeds,
  // });

  // console.log(animalBreeds);

  const pets = await prisma.pets.findMany({
    include: {
      animal_types: true,
    },
  });
  console.log("pet", pets);

  let mockPetImages: any = [];
  // for (let i = 0; i < 2; i++) {
  //  @ts-ignore

  for (const _pet of mockPets) {
    let file =
      _pet.animal_type_id == BigInt(90)
        ? dogImages[faker.datatype.number({ max: dogImages.length - 1 })]
        : catImages[faker.datatype.number({ max: catImages.length - 1 })];

    const contents = fs.readFileSync(
      process.cwd() + "/images/pet_images/" + file,
      {
        encoding: "base64",
      }
    );

    console.log(
      "animal type id",
      _pet.animal_type_id,
      _pet.animal_type_id == BigInt(90)
    );

    const petPath = `public/${
      _pet.animal_type_id == BigInt(90)
        ? dogImages[faker.datatype.number({ max: dogImages.length - 1 })]
        : catImages[faker.datatype.number({ max: catImages.length - 1 })]
    }`;

    console.log("pet path", petPath);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("pets")
      .upload(petPath, decode(contents), {
        cacheControl: "3600",
        contentType: "image/jpg",
      });

    console.log(uploadData);
    console.log(uploadError);

    // @ts-ignore
    if (uploadData || uploadError?.statusCode == 409) {
      console.log("saved pet", _pet);

      const savedPet = await prisma.pets.create({
        // @ts-ignore
        data: _pet,
      });

      mockPetImages.push({
        pet_id: savedPet.id,
        url: `https://fhasuqzjmruhvugclutt.supabase.co/storage/v1/object/public/pets/public/${file}`,
      });

      let petImages = await prisma.pet_images.create({
        data: {
          pet_id: savedPet.id,
          url: `https://fhasuqzjmruhvugclutt.supabase.co/storage/v1/object/public/pets/public/${file}`,
        },
      });
      console.log("count", mockPetImages.length);

      console.log(petImages);
    }
  }
  // }

  // const petImages = await prisma.pet_images.createMany({
  //   data: mockPetImages,
  // });

  // console.log("pet images", petImages);

  // const petImages = await prisma.pet_images.findMany();
  // console.log(petImages);

  // let mockPetLostMeta = pets.map((pet) => {
  //   return {
  //     pet_id: pet.id,
  //     lost_date: faker.date.recent(),
  //     longitude:
  //       vermontBurlingtonGeo.lon +
  //       faker.datatype.float({ precision: 0.0001, max: 1 }),
  //     latitude:
  //       vermontBurlingtonGeo.lat +
  //       faker.datatype.float({ precision: 0.0001, max: 1 }),
  //   };
  // });
  // console.log(mockPetLostMeta);

  // await prisma.lost_meta.createMany({
  //   data: mockPetLostMeta,
  // });

  // const lostMeta = await prisma.lost_meta.findMany();
  // console.log(lostMeta);
}

// function humanize(str: string) {
//   let i,
//     frags = str.split("_");
//   for (i = 0; i < frags.length; i++) {
//     frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
//   }
//   return frags.join(" ");
// }

main();
