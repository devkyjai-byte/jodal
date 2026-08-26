/**
 * 온보딩 스텝 2~3 e2e (02-04-PLAN.md task 1 acceptance_criteria):
 * - 대분류 2개(43,44) + 중분류 1개(4412) 등록 후 GET /companies/me/classification-codes가 3건 반환
 * - 다른 업체 소유의 classification-code id로 DELETE 시도 시 403
 * - 지역 2개(서울특별시, 경기도) 등록 후 GET /companies/me가 regionCodes와 classificationCodes를 함께 반환
 *
 * 사전 조건: 02-02-PLAN.md의 tracer.e2e-spec.ts와 동일 — DATABASE_URL/JWT_SECRET/
 * BUSINESS_REG_NO_ENCRYPTION_KEY/BUSINESS_REG_NO_HMAC_PEPPER 환경변수와 migrate deploy 적용.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { SignupResult } from '../src/auth/auth.service';

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

async function signupCompany(
  app: INestApplication<App>,
  label: string,
): Promise<{ accessToken: string; companyId: string }> {
  const res = await request(app.getHttpServer())
    .post('/auth/signup')
    .send({
      businessRegNo: buildValidBusinessRegNo(),
      companyName: `${label} 테스트 업체`,
      contactEmail: `${label}-${Date.now()}@example.com`,
      password: 'Str0ngPassw0rd!',
      privacyConsent: true,
    })
    .expect(201);
  const body = res.body as SignupResult;
  return { accessToken: body.accessToken, companyId: body.company.id };
}

describe('온보딩 스텝 2~3: 업종·지역 CRUD (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  let companyA: { accessToken: string; companyId: string };
  let companyB: { accessToken: string; companyId: string };

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

    companyA = await signupCompany(app, 'a');
    companyB = await signupCompany(app, 'b');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('대분류 2개(43,44) + 중분류 1개(4412) 등록 후 GET이 3건 반환', async () => {
    for (const code of ['43', '44', '4412']) {
      await request(app.getHttpServer())
        .post('/companies/me/classification-codes')
        .set('Authorization', `Bearer ${companyA.accessToken}`)
        .send({ code })
        .expect(201);
    }

    const res = await request(app.getHttpServer())
      .get('/companies/me/classification-codes')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .expect(200);

    const body = res.body as { id: string; classificationCode: string }[];
    expect(body.length).toBe(3);
    expect(body.map((c) => c.classificationCode).sort()).toEqual(
      ['43', '44', '4412'].sort(),
    );
  });

  it('다른 업체 소유의 classification-code id로 DELETE 시도 시 403', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/companies/me/classification-codes')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .expect(200);
    const body = listRes.body as { id: string; classificationCode: string }[];
    const targetId = body[0].id;

    await request(app.getHttpServer())
      .delete(`/companies/me/classification-codes/${targetId}`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(403);
  });

  it('지역 2개(서울특별시, 경기도) 등록 후 GET /companies/me가 regionCodes와 classificationCodes를 함께 반환', async () => {
    await request(app.getHttpServer())
      .patch('/companies/me')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .send({ regionCodes: ['서울특별시', '경기도'] })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/companies/me')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .expect(200);

    const body = res.body as {
      regionCodes: string[];
      classificationCodes: { id: string; classificationCode: string }[];
      profileComplete: boolean;
    };
    expect(body.regionCodes).toEqual(['서울특별시', '경기도']);
    expect(body.classificationCodes.length).toBe(3);
    expect(body.profileComplete).toBe(true);
  });
});
