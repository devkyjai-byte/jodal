import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { MatchingModule } from '../matching/matching.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IngestProcessor } from './ingest.processor';
import { MatchProcessor } from './match.processor';
import { NotifyProcessor } from '../notifications/notify.processor';

/**
 * ingest/match/notify 3개 큐를 한 번에 등록한다(02-05-PLAN.md) — 다른 모듈(matching,
 * notifications)이 재등록 없이 @InjectQueue로 가져다 쓸 수 있게 하기 위함.
 *
 * [02-07 Rule 3 편차] 02-07-PLAN.md의 notify.processor.ts <files> 목록에는 이 모듈이
 * 없었으나, NotifyProcessor(@Processor('notify'))를 어딘가의 NestJS providers에 등록하지
 * 않으면 DI 컨테이너가 이 클래스를 인스턴스화하지 않아 큐 컨슈머 자체가 동작하지 않는다
 * (02-02-SUMMARY.md Deviation #8과 동일 사유 — 배선 누락). IngestProcessor/MatchProcessor와
 * 동일한 패턴으로 이 모듈에 등록하고, NotifyProcessor가 필요로 하는 NotificationsService를
 * 쓰기 위해 NotificationsModule을 import한다(순환 의존 없음 — NotificationsModule은
 * QueuesModule을 참조하지 않는다).
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
    MatchingModule,
    NotificationsModule,
  ],
  providers: [IngestProcessor, MatchProcessor, NotifyProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
