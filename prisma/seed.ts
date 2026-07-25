import { ConcertStatus, DiscountType, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const operator = await prisma.user.upsert({
    where: { email: 'operator@ticketing.local' },
    update: {},
    create: {
      email: 'operator@ticketing.local',
      passwordHash,
      fullName: 'Ops Operator',
      role: Role.OPERATOR,
    },
  });

  const customer1 = await prisma.user.upsert({
    where: { email: 'customer1@ticketing.local' },
    update: {},
    create: {
      email: 'customer1@ticketing.local',
      passwordHash,
      fullName: 'Nguyen Van A',
      role: Role.CUSTOMER,
    },
  });

  const customer2 = await prisma.user.upsert({
    where: { email: 'customer2@ticketing.local' },
    update: {},
    create: {
      email: 'customer2@ticketing.local',
      passwordHash,
      fullName: 'Tran Thi B',
      role: Role.CUSTOMER,
    },
  });

  const flashSaleConcert = await prisma.concert.upsert({
    where: { id: 'seed-concert-flash-sale' },
    update: {},
    create: {
      id: 'seed-concert-flash-sale',
      name: 'Imagine Dragons Live in Saigon',
      description: 'Launch-week flash sale headline concert — deliberately small inventory for testing oversell protection.',
      venue: 'Quan Khu 7 Stadium, Ho Chi Minh City',
      startTime: new Date('2026-11-15T12:00:00.000Z'),
      status: ConcertStatus.PUBLISHED,
      ticketCategories: {
        create: [
          { name: 'VIP', price: 3500000, totalQuantity: 5, availableQuantity: 5 },
          { name: 'Standard', price: 1200000, totalQuantity: 50, availableQuantity: 50 },
        ],
      },
    },
  });

  const upcomingConcert = await prisma.concert.upsert({
    where: { id: 'seed-concert-upcoming' },
    update: {},
    create: {
      id: 'seed-concert-upcoming',
      name: 'Acoustic Night with Da LAB',
      description: 'A relaxed acoustic evening.',
      venue: 'Sofitel Plaza Hanoi',
      startTime: new Date('2026-12-20T13:00:00.000Z'),
      status: ConcertStatus.PUBLISHED,
      ticketCategories: {
        create: [
          { name: 'Standard', price: 800000, totalQuantity: 100, availableQuantity: 100 },
        ],
      },
    },
  });

  const draftConcert = await prisma.concert.upsert({
    where: { id: 'seed-concert-draft' },
    update: {},
    create: {
      id: 'seed-concert-draft',
      name: 'TBA Spring Festival 2027',
      description: 'Still being planned by the operation team — not visible to customers yet.',
      venue: 'TBA',
      startTime: new Date('2027-03-01T12:00:00.000Z'),
      status: ConcertStatus.DRAFT,
      ticketCategories: {
        create: [{ name: 'General Admission', price: 500000, totalQuantity: 300, availableQuantity: 300 }],
      },
    },
  });

  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneMonthAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.voucher.upsert({
    where: { code: 'FLASH50' },
    update: {},
    create: {
      code: 'FLASH50',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 50,
      totalQuantity: 3,
      remainingQuantity: 3,
      maxDiscountAmount: 1000000,
      perUserLimit: 1,
      validFrom: oneMonthAgo,
      validTo: oneMonthAhead,
    },
  });

  await prisma.voucher.upsert({
    where: { code: 'WELCOME100K' },
    update: {},
    create: {
      code: 'WELCOME100K',
      discountType: DiscountType.FIXED,
      discountValue: 100000,
      totalQuantity: 500,
      remainingQuantity: 500,
      minOrderAmount: 300000,
      perUserLimit: 1,
      validFrom: oneMonthAgo,
      validTo: oneMonthAhead,
    },
  });

  console.log('Seeded users:', { operator: operator.email, customer1: customer1.email, customer2: customer2.email });
  console.log('Seeded concerts:', { flashSaleConcert: flashSaleConcert.name, upcomingConcert: upcomingConcert.name, draftConcert: draftConcert.name });
  console.log('All seed passwords: Password123!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
