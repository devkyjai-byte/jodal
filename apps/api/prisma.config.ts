// Prisma 7 설정 파일 — datasource URL과 마이그레이션 경로는 스키마 파일이 아니라
// 여기서 관리한다 (schema.prisma의 `datasource.url` 필드는 Prisma 7부터 지원되지 않음,
// https://pris.ly/d/config-datasource 참고). PrismaClient 런타임 연결은
// src/prisma/prisma.service.ts에서 @prisma/adapter-pg 드라이버 어댑터로 별도 구성한다.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
