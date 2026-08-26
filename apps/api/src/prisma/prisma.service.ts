import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService — 02-02 이후 모든 모듈이 이 서비스를 주입받아 재사용한다.
 *
 * Prisma 7부터 PrismaClient는 드라이버 어댑터가 필수다(schema.prisma의
 * `datasource.url`은 더 이상 지원되지 않음, https://pris.ly/d/driver-adapters).
 * 여기서는 @prisma/adapter-pg로 DATABASE_URL 기반 연결을 구성한다.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL 환경변수가 설정되지 않았습니다. .env(로컬)에 값을 채워 넣으세요 — env.example 참고.',
      );
    }

    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from PostgreSQL');
  }
}
