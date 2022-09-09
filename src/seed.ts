import { PrismaClient } from "@prisma/client";
import { faker } from '@faker-js/faker';
const prisma = new PrismaClient();

async function main() {
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

  await prisma.animal_breeds.createMany(
    {
      data: [
        {name: 'Maine Coon', animal_type_id: animalTypes.find(_animalType => _animalType.name === 'Cat')?.id},
        {name: 'Persian', animal_type_id: animalTypes.find(_animalType => _animalType.name === 'Cat')?.id},
      ]
    })

  const animalBreeds = await prisma.animal_breeds.findMany()
  console.log(animalBreeds)

  let mockPets = []
  let hello = []
  
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


}



main();
