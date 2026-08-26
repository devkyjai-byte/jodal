import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { MatchingService } from '../matching/matching.service';
import { PrismaService } from '../prisma/prisma.service';

interface ComputeMatchesJobData {
  announcementIds: string[];
}

/**
 * MATCH-01 팬아웃 재매칭 워커 — 02-RESEARCH.md Pattern 1의 2단계.
 * ingest.processor.ts가 새로 upsert한 announcementIds를 받아 전체 업체 대상으로
 * 재매칭하고, min_score_threshold 이상인 매칭만 notify 큐로 넘긴다(3단계, 02-07이 소비).
 */
@Processor('match')
export class MatchProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchProcessor.name);

  constructor(
    private readonly matchingService: MatchingService,
    private readonly prisma: PrismaService,
    @InjectQueue('notify') private readonly notifyQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<ComputeMatchesJobData>): Promise<void> {
    const { announcementIds } = job.data;
    const { matchIds } =
      await this.matchingService.scoreAndUpsertForAnnouncements(
        announcementIds,
      );

    if (matchIds.length === 0) {
      this.logger.log(`Match job ${job.id}: 0 matches upserted`);
      return;
    }

    // 02-02의 NotificationsService가 업체별 임계값을 최종적으로 다시 확인하므로 여기서
    // 과다 후보를 넘겨도 안전하지만, 발송 큐 부하를 줄이기 위해 명시적으로 걸러 넘긴다.
    const matches = await this.prisma.match.findMany({
      where: { id: { in: matchIds } },
      include: { company: { include: { notificationSettings: true } } },
    });

    const eligibleMatchIds = matches
      .filter((m) => {
        const threshold = m.company.notificationSettings?.minScoreThreshold;
        return threshold != null && Number(m.score) >= Number(threshold);
      })
      .map((m) => m.id);

    if (eligibleMatchIds.length > 0) {
      await this.notifyQueue.add('dispatch-notifications', {
        matchIds: eligibleMatchIds,
      });
    }

    this.logger.log(
      `Match job ${job.id}: ${matchIds.length} matches upserted, ${eligibleMatchIds.length} queued for notification`,
    );
  }
}
