/**
 * 시드 스크립트 — apps/api/tests/fixtures/announcements.sample.json의 픽스처 공고를
 * bid_announcements 테이블에 적재한다. `npm run db:seed`로 실행한다.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';

interface AnnouncementFixture {
  sourceBidNo: string;
  sourceRevisionNo: string;
  isLatestRevision: boolean;
  title: string;
  classificationCode: string | null;
  regionCodes: string[];
  agencyName: string;
  budgetAmount: string;
  bidOpenAt: string;
  bidCloseAt: string;
  rawPayload: Record<string, unknown>;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL 환경변수가 설정되지 않았습니다.');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const fixturePath = join(
    __dirname,
    '..',
    'tests',
    'fixtures',
    'announcements.sample.json',
  );
  const fixtures = JSON.parse(
    readFileSync(fixturePath, 'utf-8'),
  ) as AnnouncementFixture[];

  console.log(
    `Seeding ${fixtures.length} bid_announcements from ${fixturePath}...`,
  );

  for (const fixture of fixtures) {
    await prisma.bidAnnouncement.upsert({
      where: {
        sourceBidNo_sourceRevisionNo: {
          sourceBidNo: fixture.sourceBidNo,
          sourceRevisionNo: fixture.sourceRevisionNo,
        },
      },
      create: {
        sourceBidNo: fixture.sourceBidNo,
        sourceRevisionNo: fixture.sourceRevisionNo,
        isLatestRevision: fixture.isLatestRevision,
        title: fixture.title,
        classificationCode: fixture.classificationCode,
        regionCodes: fixture.regionCodes,
        agencyName: fixture.agencyName,
        budgetAmount: new Prisma.Decimal(fixture.budgetAmount),
        bidOpenAt: new Date(fixture.bidOpenAt),
        bidCloseAt: new Date(fixture.bidCloseAt),
        rawPayload: fixture.rawPayload as Prisma.InputJsonValue,
      },
      update: {
        title: fixture.title,
        classificationCode: fixture.classificationCode,
        regionCodes: fixture.regionCodes,
        agencyName: fixture.agencyName,
        budgetAmount: new Prisma.Decimal(fixture.budgetAmount),
        bidOpenAt: new Date(fixture.bidOpenAt),
        bidCloseAt: new Date(fixture.bidCloseAt),
        rawPayload: fixture.rawPayload as Prisma.InputJsonValue,
      },
    });
  }

  const count = await prisma.bidAnnouncement.count();
  console.log(`Seed complete. bid_announcements row count: ${count}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exitCode = 1;
});
