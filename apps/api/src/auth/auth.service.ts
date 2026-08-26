import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Company, Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import {
  digestBusinessRegNo,
  encryptBusinessRegNo,
  isValidBusinessRegNoFormat,
} from './crypto/business-reg-no.crypto';
import { hashPassword } from './crypto/password.crypto';
import { SignupDto } from './dto/signup.dto';

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
