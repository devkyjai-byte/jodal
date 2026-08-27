import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // CORS 오리진 allowlist — CORS_ORIGIN(쉼표 구분)이 없으면 apps/web 로컬 개발 서버(3000)만
  // 허용한다(02-REVIEW.md WR-03: 프로덕션에 무제한 오리진 반영 방지).
  const corsOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0) ?? ['http://localhost:3000'];
  app.enableCors({ origin: corsOrigins });
  // ASVS V5 Input Validation — DTO의 class-validator 데코레이터를 전역으로 적용.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // apps/web(Next.js)이 기본 3000 포트를 쓰므로 API는 3001을 기본값으로 한다
  // (docker-compose 없이 `node scripts/dev.cjs`로 두 워크스페이스를 동시 기동할 때
  // EADDRINUSE 충돌 방지 — 02-01 tracer task 검증 중 발견한 Rule 1 버그).
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
