import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

/**
 * JwtStrategy를 여기서 provider로 등록하면 passport에 'jwt' 전략이 전역 등록되어,
 * 다른 모듈(CompaniesModule 등)이 이 모듈을 다시 import하지 않고도 JwtAuthGuard를
 * 사용할 수 있다(Nest DI가 이 provider를 1회 인스턴스화하는 시점에 전략이 등록됨).
 */
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtStrategy],
})
export class AuthModule {}
