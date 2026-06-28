import prisma from './src/config/prisma.js';

async function main() {
  const privateBores = await prisma.borewell_data.findMany();
  console.log('--- PRIVATE BORES (borewell_data) ---');
  console.log(JSON.stringify(privateBores, null, 2));

  const govtBores = await prisma.borewellWork.findMany({
    include: {
      village: true,
      mandal: true
    }
  });
  console.log('\n--- GOVT BORES (BorewellWork) ---');
  console.log(JSON.stringify(govtBores, null, 2));
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
