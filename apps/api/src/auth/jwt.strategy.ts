import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/** payload에는 companyId만 담는다 (02-02-PLAN.md 지시) — 최소 권한 원칙. */
export interface JwtPayload {
  companyId: string;
}

/**
 * 이 엔드포인트(classification-codes)와 이후 모든 플랜(02-03~02-07)의 인증 필요
 * 엔드포인트가 공통으로 재사용하는 전략. JwtAuthGuard가 이 전략을 래핑한다.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        'JWT_SECRET 환경변수가 설정되지 않았습니다. env.example 참고.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload?.companyId) {
      throw new UnauthorizedException();
    }
    return { companyId: payload.companyId };
  }
}
