import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Company, Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import {
  digestBusinessRegNo,
  encryptBusinessRegNo,
  isValidBusinessRegNoFormat,
} from './crypto/business-reg-no.crypto';
import { hashPassword, verifyPassword } from './crypto/password.crypto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

// T-02-18 위협 대응 — 이메일 미존재/비밀번호 불일치를 항상 동일한 401 문구로 응답한다
// (사용자 열거 방지, 02-03-PLAN.md threat_model).
const INVALID_CREDENTIALS_MESSAGE = '이메일 또는 비밀번호가 올바르지 않습니다.';

/**
 * 존재하지 않는 email로 로그인 시도해도 scrypt 비교를 항상 실행해 응답 시간 차이를
 * 최소화하기 위한 더미 해시. 최초 호출 시 1회만 계산해 캐시한다(요청마다 재계산하면
 * 매번 새 scrypt 비용이 들 뿐 타이밍 안전성에는 기여하지 않음 — 파라미터 N/r/p가
 * 고정이라 salt/hash 값 자체는 타이밍에 영향을 주지 않는다).
 */
let dummyPasswordHashPromise: Promise<string> | null = null;
function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHashPromise ??= hashPassword(
    'dummy-password-for-timing-safety-x7q9',
  );
  return dummyPasswordHashPromise;
}

export interface SignupResult {
  accessToken: string;
  company: {
    id: string;
    companyName: string;
    contactEmail: string;
  };
}

// T-02-01 위협 대응 — JWT 24시간 만료 (db-schema-design.md·02-02-PLAN.md threat_model)
const JWT_EXPIRES_IN = '24h';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 회원가입: 사업자등록번호 형식 검증 → 암호화+다이제스트 → 비밀번호 해시 → companies +
   * notification_settings 생성(Prisma 중첩 쓰기 — 관계형 DB에서 암묵적 단일 트랜잭션으로
   * 실행됨, https://www.prisma.io/docs/orm/prisma-client/queries/transactions#nested-writes)
   * → JWT 발급. 로그인 엔드포인트(POST /auth/login)는 02-03 범위.
   */
  async signup(dto: SignupDto): Promise<SignupResult> {
    if (!dto.privacyConsent) {
      throw new BadRequestException(
        '개인정보 수집·이용에 동의해야 가입할 수 있습니다.',
      );
    }
    if (!isValidBusinessRegNoFormat(dto.businessRegNo)) {
      throw new BadRequestException('사업자등록번호 형식이 올바르지 않습니다.');
    }

    const businessRegNoEncrypted = encryptBusinessRegNo(dto.businessRegNo);
    const businessRegNoDigest = digestBusinessRegNo(dto.businessRegNo);
    const passwordHash = await hashPassword(dto.password);

    let company: Company;
    try {
      company = await this.prisma.company.create({
        data: {
          companyName: dto.companyName,
          contactEmail: dto.contactEmail,
          passwordHash,
          // PROF-02(활동 지역)는 01-onboarding.md 스텝 3 — 이 플랜(스텝 1만 연결)의 범위 밖.
          // 스키마 필수 필드라 빈 배열로 시작하고, 이후 프로필 화면에서 채운다.
          regionCodes: [],
          // Buffer(ArrayBufferLike)를 Prisma의 Bytes(Uint8Array<ArrayBuffer>) 타입에 맞춘다
          // (@types/node 24 + Prisma 7 조합에서 발생하는 TS 구조적 타입 불일치 — 값은 그대로).
          businessRegNoEncrypted: Uint8Array.from(businessRegNoEncrypted),
          businessRegNoDigest: Uint8Array.from(businessRegNoDigest),
          notificationSettings: {
            create: {
              emailEnabled: true,
            },
          },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // uq_companies_business_reg_no_digest UNIQUE 위반 — 이미 등록된 사업자등록번호
        throw new ConflictException('이미 등록된 사업자등록번호입니다.');
      }
      throw err;
    }

    const accessToken = this.signToken(company.id);

    return {
      accessToken,
      company: {
        id: company.id,
        companyName: company.companyName,
        contactEmail: company.contactEmail,
      },
    };
  }

  /**
   * 로그인: `companies.contact_email`로 조회 후 password.crypto.ts의 scrypt 비교로 검증한다.
   * 이메일을 1차 로그인 식별자로 채택한 이유(02-03-PLAN.md 재량 결정) — 와이어프레임에
   * 로그인 화면 필드가 명시되어 있지 않았고, contact_email이 이미 NOT NULL이며,
   * 사업자등록번호를 로그인 폼에 다시 입력시키면 마스킹 규칙과 충돌하기 때문이다.
   *
   * T-02-18 대응: 이메일 미존재/비밀번호 불일치를 항상 동일한 401 문구로 응답하고,
   * 이메일이 존재하지 않아도 더미 해시와 scrypt 비교를 수행해 응답 시간 차이를 줄인다.
   */
  async login(dto: LoginDto): Promise<SignupResult> {
    const company = await this.prisma.company.findUnique({
      where: { contactEmail: dto.email },
    });

    const storedHash = company?.passwordHash ?? (await getDummyPasswordHash());
    const isValid = await verifyPassword(dto.password, storedHash);

    if (!company || !isValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const accessToken = this.signToken(company.id);

    return {
      accessToken,
      company: {
        id: company.id,
        companyName: company.companyName,
        contactEmail: company.contactEmail,
      },
    };
  }

  private signToken(companyId: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        'JWT_SECRET 환경변수가 설정되지 않았습니다. env.example 참고.',
      );
    }
    return jwt.sign({ companyId }, secret, { expiresIn: JWT_EXPIRES_IN });
  }
}
