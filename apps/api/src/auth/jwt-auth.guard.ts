import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * AuthGuard('jwt') 래퍼 — classification-codes.controller.ts와 이후 모든 인증 필요
 * 엔드포인트가 `@UseGuards(JwtAuthGuard)`로 재사용한다. JWT 없이 호출 시 401.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
