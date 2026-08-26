import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from './crypto/password.crypto';

/**
 * POST /auth/login — 02-03-PLAN.md Task 1 <behavior> 3가지 케이스를 검증한다.
 * PrismaService/NtsVerificationPort는 모킹해 실DB·외부 API 없이 컨트롤러→서비스 경로를
 * end-to-end로 검증한다(이 실행 환경에 Docker/PostgreSQL이 없음 — 02-01/02-02-SUMMARY.md와 동일 갭).
 */
describe('AuthController - POST /auth/login', () => {
  let controller: AuthController;
  let prismaMock: {
    company: { findUnique: jest.Mock };
  };
  const EXISTING_EMAIL = 'existing@example.com';
  const CORRECT_PASSWORD = 'CorrectPassw0rd!';
  let existingPasswordHash: string;

  const UNAUTHORIZED_MESSAGE = '이메일 또는 비밀번호가 올바르지 않습니다.';

  beforeAll(async () => {
    process.env.JWT_SECRET ??= 'test-jwt-secret-please-change-in-prod';
    existingPasswordHash = await hashPassword(CORRECT_PASSWORD);
  });

  beforeEach(async () => {
    prismaMock = {
      company: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('올바른 email+password → 200 + JWT(payload에 companyId)', async () => {
    prismaMock.company.findUnique.mockResolvedValue({
      id: 'company-1',
      companyName: '테스트 업체',
      contactEmail: EXISTING_EMAIL,
      passwordHash: existingPasswordHash,
    });

    const result = await controller.login({
      email: EXISTING_EMAIL,
      password: CORRECT_PASSWORD,
    });

    expect(typeof result.accessToken).toBe('string');
    expect(result.accessToken.length).toBeGreaterThan(0);
    const payload = jwt.decode(result.accessToken) as { companyId: string };
    expect(payload.companyId).toBe('company-1');
    expect(result.company.id).toBe('company-1');
  });

  it('존재하지 않는 email → 401, 문구는 "이메일 또는 비밀번호가 올바르지 않습니다"', async () => {
    prismaMock.company.findUnique.mockResolvedValue(null);

    await expect(
      controller.login({ email: 'nobody@example.com', password: 'whatever123' }),
    ).rejects.toMatchObject({
      response: { message: UNAUTHORIZED_MESSAGE },
    });
    await expect(
      controller.login({ email: 'nobody@example.com', password: 'whatever123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('존재하는 email + 틀린 password → 동일한 401 + 동일 문구(사용자 열거 방지)', async () => {
    prismaMock.company.findUnique.mockResolvedValue({
      id: 'company-1',
      companyName: '테스트 업체',
      contactEmail: EXISTING_EMAIL,
      passwordHash: existingPasswordHash,
    });

    await expect(
      controller.login({ email: EXISTING_EMAIL, password: 'WrongPassword!' }),
    ).rejects.toMatchObject({
      response: { message: UNAUTHORIZED_MESSAGE },
    });
  });
});
