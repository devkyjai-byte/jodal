/**
 * Tracer e2e: 회원가입 → 업종등록 → 매칭 → 알림기록 (02-02-PLAN.md acceptance_criteria).
 *
 * 사전 조건: `npx prisma migrate deploy` + `npm run db:seed`가 적용된 DATABASE_URL,
 * JWT_SECRET / BUSINESS_REG_NO_ENCRYPTION_KEY / BUSINESS_REG_NO_HMAC_PEPPER 환경변수.
 * 02-01의 schema.e2e-spec.ts(스키마 존재만 확인)와 달리, 이 테스트는 실제 비즈니스
 * 로직(회원가입·매칭·알림)을 검증하며 Postgres에 실제로 행을 씁니다.
 *
 * tests/fixtures/announcements.sample.json의 classification_code='43211501' 픽스처
 * 2건(20260801001, 20260801002)이 prefix '43' 등록 시 매칭 후보가 된다.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { SignupResult } from '../src/auth/auth.service';

/**
 * 국세청 공개 체크섬 알고리즘으로 유효한 사업자등록번호를 생성한다(테스트 전용).
 * 타임스탬프 기반 앞 9자리를 써서 반복 실행 시 UNIQUE(business_reg_no_digest) 충돌을 피한다.
 */
function buildValidBusinessRegNo(): string {
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const base = Date.now().toString().slice(-9).padStart(9, '0');
  const digits = base.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += digits[i] * weights[i];
  }
  sum += Math.floor((digits[8] * 5) / 10);
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${base}${checkDigit}`;
}

describe('Signup -> classification code -> matching -> notification (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  const businessRegNo = buildValidBusinessRegNo();
  const contactEmail = `tracer-${Date.now()}@example.com`;
  let accessToken = '';
  let companyId = '';

  beforeAll(async () => {
    const requiredEnv = [
      'DATABASE_URL',
      'JWT_SECRET',
      'BUSINESS_REG_NO_ENCRYPTION_KEY',
      'BUSINESS_REG_NO_HMAC_PEPPER',
    ];
    for (const key of requiredEnv) {
      if (!process.env[key]) {
        throw new Error(
          `${key} 환경변수가 설정되지 않았습니다. env.example을 .env로 복사 후 값을 채워 넣으세요.`,
        );
      }
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    prisma = new PrismaClient({ adapter });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('POST /auth/signup → 201 + JWT 발급', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        businessRegNo,
        companyName: '조달메이트 트레이서 테스트 업체',
        contactEmail,
        password: 'Str0ngPassw0rd!',
        privacyConsent: true,
      })
      .expect(201);

    const body = res.body as SignupResult;
    expect(typeof body.accessToken).toBe('string');
    expect(body.accessToken.length).toBeGreaterThan(0);
    expect(body.company?.id).toBeDefined();

    accessToken = body.accessToken;
    companyId = body.company.id;
  });

  it('동일 사업자등록번호로 재가입 시도 → 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        businessRegNo,
        companyName: '중복 가입 시도 업체',
        contactEmail: `dup-${Date.now()}@example.com`,
        password: 'Str0ngPassw0rd!',
        privacyConsent: true,
      })
      .expect(409);
  });

  it('JWT 없이 분류코드 등록 시도 → 401', async () => {
    await request(app.getHttpServer())
      .post('/companies/me/classification-codes')
      .send({ code: '43' })
      .expect(401);
  });

  it('POST /companies/me/classification-codes {code:"43"} → 201', async () => {
    await request(app.getHttpServer())
      .post('/companies/me/classification-codes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: '43' })
      .expect(201);
  });

  it('DB에 matches 행이 생성되고 score > 0', async () => {
    const matches = await prisma.match.findMany({ where: { companyId } });
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(Number(match.score)).toBeGreaterThan(0);
    }
  });

  it("notification_logs에 channel='email', status='sent' 행이 정확히 1건 존재", async () => {
    const logs = await prisma.notificationLog.findMany({
      where: {
        channel: 'email',
        status: 'sent',
        match: { companyId },
      },
    });
    expect(logs.length).toBe(1);
  });

  it('companies 테이블에 평문 사업자등록번호 컬럼이 여전히 존재하지 않는다', async () => {
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
