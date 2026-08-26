import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { NTS_VERIFICATION_PORT } from './verification/nts-verification.port';

/**
 * AuthService.signup() — 02-03-PLAN.md Task 2 acceptance_criteria 검증.
 * PrismaService/NtsVerificationPort를 모킹해 실DB·외부 API 없이 검증한다
 * (이 실행 환경에 Docker/PostgreSQL이 없음 — 02-01/02-02-SUMMARY.md와 동일 갭).
 */

/** 국세청 공개 체크섬 알고리즘으로 유효한 사업자등록번호를 생성한다(테스트 전용). */
function buildValidBusinessRegNo(seed: number): string {
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const base = String(seed).padStart(9, '0').slice(-9);
  const digits = base.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += digits[i] * weights[i];
  }
  sum += Math.floor((digits[8] * 5) / 10);
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${base}${checkDigit}`;
}

describe('AuthService.signup - 국세청 진위확인 비동기 처리', () => {
  let service: AuthService;
  let prismaMock: {
    company: { create: jest.Mock; update: jest.Mock };
  };
  let ntsMock: { verify: jest.Mock };

  beforeAll(() => {
    process.env.JWT_SECRET ??= 'test-jwt-secret-please-change-in-prod';
    process.env.BUSINESS_REG_NO_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString(
      'base64',
    );
    process.env.BUSINESS_REG_NO_HMAC_PEPPER ??= 'test-pepper';
  });

  beforeEach(async () => {
    prismaMock = {
      company: {
        create: jest.fn().mockResolvedValue({
          id: 'company-1',
          companyName: '테스트 업체',
          contactEmail: 'test@example.com',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    ntsMock = { verify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NTS_VERIFICATION_PORT, useValue: ntsMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('국세청 API가 네트워크 오류를 던져도 signup()의 응답에는 영향이 없다(비동기, non-blocking)', async () => {
    ntsMock.verify.mockRejectedValue(new Error('network error'));

    const result = await service.signup({
      businessRegNo: buildValidBusinessRegNo(1),
      companyName: '테스트 업체',
      contactEmail: 'test@example.com',
      password: 'Str0ngPassw0rd!',
      privacyConsent: true,
    });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.company.id).toBe('company-1');

    // fire-and-forget 체인이 처리될 microtask를 흘려보낸다.
    await Promise.resolve();
    await Promise.resolve();
    expect(ntsMock.verify).toHaveBeenCalledWith(buildValidBusinessRegNo(1));
    // 실패했으므로 verification_status는 갱신되지 않는다(pending 유지, 로그만 남김).
    expect(prismaMock.company.update).not.toHaveBeenCalled();
  });

  it('국세청 API가 verified를 반환하면 verification_status가 비동기로 갱신된다', async () => {
    ntsMock.verify.mockResolvedValue('verified');

    await service.signup({
      businessRegNo: buildValidBusinessRegNo(2),
      companyName: '테스트 업체',
      contactEmail: 'test@example.com',
      password: 'Str0ngPassw0rd!',
      privacyConsent: true,
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(prismaMock.company.update).toHaveBeenCalledWith({
      where: { id: 'company-1' },
      data: {
        verificationStatus: 'verified',
        verifiedAt: expect.any(Date) as Date,
      },
    });
  });

  it('이미 등록된 사업자등록번호(다이제스트 UNIQUE 위반)로 가입 시도 시 409', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '7.10.0',
    });
    prismaMock.company.create.mockRejectedValueOnce(p2002);

    await expect(
      service.signup({
        businessRegNo: buildValidBusinessRegNo(3),
        companyName: '중복 업체',
        contactEmail: 'dup@example.com',
        password: 'Str0ngPassw0rd!',
        privacyConsent: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
