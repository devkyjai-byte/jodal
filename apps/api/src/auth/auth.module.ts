import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { NtsVerificationAdapter } from './verification/nts-verification.adapter';
import { NTS_VERIFICATION_PORT } from './verification/nts-verification.port';

/**
 * JwtStrategy를 여기서 provider로 등록하면 passport에 'jwt' 전략이 전역 등록되어,
 * 다른 모듈(CompaniesModule 등)이 이 모듈을 다시 import하지 않고도 JwtAuthGuard를
 * 사용할 수 있다(Nest DI가 이 provider를 1회 인스턴스화하는 시점에 전략이 등록됨).
 *
 * NTS_VERIFICATION_PORT는 notifications 모듈의 EMAIL_SENDER_PORT와 동일한 포트/어댑터
 * 패턴 — 국세청 API 엔드포인트가 확정된 이후에도 어댑터만 교체하면 된다.
 */
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: NTS_VERIFICATION_PORT, useClass: NtsVerificationAdapter },
  ],
  exports: [JwtStrategy],
})
export class AuthModule {}
