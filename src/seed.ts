import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.animal_types.deleteMany()
  await prisma.animal_breeds.deleteMany()

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
}

main();
