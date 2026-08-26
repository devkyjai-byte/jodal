import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { AnnouncementsService } from '../announcements/announcements.service';

/**
 * ING-01 배치 수집 워커 — 02-RESEARCH.md Pattern 1(수집→매칭→발송)의 1단계.
 * upsertJobScheduler로 4~6회/일 리피터블 잡을 등록하고, 잡 완료 시 새로 upsert된
 * announcementIds가 있으면 match 큐로 팬아웃한다.
 */
@Processor('ingest')
export class IngestProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(IngestProcessor.name);

  constructor(
    private readonly announcementsService: AnnouncementsService,
    @InjectQueue('ingest') private readonly ingestQueue: Queue,
    @InjectQueue('match') private readonly matchQueue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // upsertJobScheduler는 중복 생성 없이 리피터블 잡을 등록/갱신한다(BullMQ 5.16+ 권장
    // API, RESEARCH.md §State of the Art). 크론 주기를 환경변수로 뺀 이유: 나라장터
    // 실제 일일 호출 한도가 아직 미확인(RESEARCH.md Pitfall 3, Open Question 1)이라
    // 승인 후 즉시 재조정이 필요하기 때문. 기본값은 보수적인 4시간(하루 6회).
    const pattern = process.env.INGEST_CRON_PATTERN ?? '0 0 */4 * * *';
    await this.ingestQueue.upsertJobScheduler(
      'poll-g2b',
      { pattern },
      { name: 'ingest-announcements', data: {} },
    );
  }

  async process(job: Job): Promise<void> {
    const { upsertedIds } = await this.announcementsService.pollAndUpsert();
    this.logger.log(
      `Ingest job ${job.id}: upserted ${upsertedIds.length} announcements`,
    );
    if (upsertedIds.length > 0) {
      await this.matchQueue.add('compute-matches', {
        announcementIds: upsertedIds,
      });
    }
  }
}
