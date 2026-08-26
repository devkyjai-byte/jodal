import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * 전역 Prisma 모듈 — 앱 전체에서 PrismaService를 다시 import하지 않고 주입받을 수 있게 한다.
 * 02-02(인증)·매칭·알림 모듈이 모두 이 모듈에 의존한다.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
