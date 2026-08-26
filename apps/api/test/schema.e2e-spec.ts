/**
 * 스키마·시드 검증 e2e 테스트 (02-01-PLAN.md tracer task acceptance_criteria).
 *
 * 사전 조건: `npx prisma migrate deploy`가 이미 적용되어 있고 `npm run db:seed`가
 * 실행된 DATABASE_URL(로컬은 docker-compose.yml의 postgres 서비스)에 연결한다.
 * 이 테스트는 스키마 자체를 검증할 뿐, 회원가입·매칭 등 비즈니스 로직은 다루지 않는다
 * (02-02·02-03 범위).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const EXPECTED_TABLES = [
  'companies',
  'company_classification_codes',
  'company_performances',
  'company_certifications',
  'bid_announcements',
  'matches',
  'notification_logs',
  'notification_settings',
  'push_subscriptions',
];

describe('Database schema (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL not set. Start docker-compose (postgres) and run `npx prisma migrate deploy` before running this test.',
      );
    }
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates all 9 tables from the Prisma migrations', async () => {
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableNames = rows.map((r) => r.table_name);

    for (const expected of EXPECTED_TABLES) {
      expect(tableNames).toContain(expected);
    }
  });

  it('seeds at least 5 bid_announcements fixtures', async () => {
    const count = await prisma.bidAnnouncement.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it('does not have a plaintext business_reg_no column on companies', async () => {
    const rows = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'companies'
    `;
    const columnNames = rows.map((r) => r.column_name);

    expect(columnNames).not.toContain('business_reg_no');
    expect(columnNames).toContain('business_reg_no_encrypted');
    expect(columnNames).toContain('business_reg_no_digest');
  });
});
