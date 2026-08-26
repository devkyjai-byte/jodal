import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { IngestProcessor } from './ingest.processor';

/**
 * ingest/match/notify 3개 큐를 한 번에 등록한다(02-05-PLAN.md) — 다른 모듈(matching,
 * notifications)이 재등록 없이 @InjectQueue로 가져다 쓸 수 있게 하기 위함. 02-07가 notify
 * 큐의 컨슈머만 추가하고 이 모듈은 수정하지 않는다.
 *
 * BullMQ 연결에는 반드시 maxRetriesPerRequest: null이 필요하다(BullMQ 공식 요구사항 —
 * 블로킹 커맨드를 쓰는 워커가 ioredis의 기본 재시도 제한과 충돌한다). 이 값이 없으면
 * 실제 Redis 환경에서 잡 처리가 예기치 않게 실패할 수 있다.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          url:
            configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
          maxRetriesPerRequest: null,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'ingest' },
      { name: 'match' },
      { name: 'notify' },
    ),
    AnnouncementsModule,
  ],
  providers: [IngestProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
