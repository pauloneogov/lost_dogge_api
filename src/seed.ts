import { PrismaClient } from "@prisma/client";
import { faker } from '@faker-js/faker';
const prisma = new PrismaClient({
  log: ['query']
});
// import breedsData from './json/breed.js'
let breedsData = require('./json/breed.js')
console.log(breedsData)

async function main() {
  await prisma.lost_meta.deleteMany()
  await prisma.pet_images.deleteMany()
  await prisma.pets.deleteMany()
  await prisma.animal_breeds.deleteMany()
  await prisma.animal_types.deleteMany()


  await prisma.animal_types.createMany({
    data: [
      {name: 'Cat'},
      {name: 'Dog'}
    ]
  })

  const animalTypes = await prisma.animal_types.findMany()
  console.log(animalTypes)


  const formattedBreeds = breedsData.map((_breed: any) => {
    return {
      name: humanize(_breed.breed),
      animal_type_id: animalTypes.find(_animalType => _animalType.name === _breed.species)?.id
    }
  })

  await prisma.animal_breeds.createMany(
    {
      data: formattedBreeds
    })

  const animalBreeds = await prisma.animal_breeds.findMany()
  console.log(animalBreeds)

  let mockPets = []
  
  for (let i = 0; i < 1000; i++) {
    mockPets.push({
      name: faker.name.firstName(),
      description: faker.lorem.paragraph(),
      weight: faker.datatype.number({max: 20}),
      height: faker.datatype.number({max: 20}),
      gender: faker.datatype.boolean(),
      breed_id: animalBreeds[faker.datatype.number({max: animalBreeds.length - 1})].id,
      is_vaccinated: faker.datatype.boolean(),
      status: faker.datatype.number({max: 2}),
      contact_number: faker.phone.number(),
      email: faker.internet.email(),
      instagram: faker.internet.domainWord(),
      facebook: faker.internet.domainWord(),
      twitter: faker.internet.domainName(),
      is_deleted: faker.datatype.boolean(),
      // user_id: 

    })
  }

  await prisma.pets.createMany({
    data: mockPets
  })

  const pets = await prisma.pets.findMany()
  console.log(pets)

  let mockPetImages: any = []
  for (let i = 0; i < 2; i++) {
    pets.forEach(_pet => {
      mockPetImages.push({
        pet_id: _pet.id,
        url: faker.image.animals()
      })
    });
  }

  await prisma.pet_images.createMany({
    data: mockPetImages
  })

  const petImages = await prisma.pet_images.findMany()
  console.log(petImages)

  let mockPetLostMeta = pets.map(pet => {
    return {
      pet_id:pet.id,
      lost_date: faker.date.recent(),
      
      longitude: parseFloat(faker.address.longitude()),
      latitude:  parseFloat(faker.address.latitude())
    }
  })
  console.log(mockPetLostMeta)

  await prisma.lost_meta.createMany({
    data: mockPetLostMeta
  })

  const lostMeta = await prisma.lost_meta.findMany()
  console.log(lostMeta)
}

function humanize(str: string) {
  let i, frags = str.split('_');
  for (i=0; i<frags.length; i++) {
    frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
  }
  return frags.join(' ');
}

main();
