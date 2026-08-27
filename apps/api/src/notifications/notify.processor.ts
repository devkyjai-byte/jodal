import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const MINUTES_PER_DAY = 24 * 60;

interface DispatchNotificationsJobData {
  matchIds: string[];
}

export interface DispatchableMatch {
  id: string;
  announcement: { title: string };
  notificationLogs: { channel: string }[];
  company: {
    companyName: string;
    contactEmail: string;
    notificationSettings: {
      emailEnabled: boolean;
      pushEnabled: boolean;
      digestFrequency: string;
      quietHoursStart: Date | null;
      quietHoursEnd: Date | null;
    } | null;
  };
}

/**
 * matchIds를 받아 이메일(이 태스크, MATCH-02) + 웹 푸시(02-07 Task 2가 추가, MATCH-03)
 * 채널로 실제 발송하는 BullMQ 컨슈머. match.processor.ts(02-05)가 enqueue한
 * 'dispatch-notifications' 잡을 소비한다 — 02-RESEARCH.md Pattern 1(수집→매칭→발송
 * 3단계 파이프라인)의 마지막 단계.
 */
@Processor('notify')
export class NotifyProcessor extends WorkerHost {
  private readonly logger = new Logger(NotifyProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @InjectQueue('notify') private readonly notifyQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<DispatchNotificationsJobData>): Promise<void> {
    const matchIds = job.data.matchIds ?? [];
    if (matchIds.length === 0) return;

    const matches = await this.prisma.match.findMany({
      where: { id: { in: matchIds } },
      include: {
        announcement: true,
        company: { include: { notificationSettings: true } },
        notificationLogs: true,
      },
    });

    for (const match of matches) {
      await this.dispatchForMatch(match);
    }
  }

  private async dispatchForMatch(match: DispatchableMatch): Promise<void> {
    const settings = match.company.notificationSettings;
    // notification_settings는 회원가입 시 항상 함께 생성되므로(auth.service.ts) 정상
    // 경로에서는 null이 될 수 없다 — 방어적으로만 체크.
    if (!settings) return;

    if (settings.quietHoursStart && settings.quietHoursEnd) {
      const nowMinutes = dateToMinutesOfDay(new Date());
      const startMinutes = dateToMinutesOfDay(settings.quietHoursStart);
      const endMinutes = dateToMinutesOfDay(settings.quietHoursEnd);

      if (isWithinQuietHours(nowMinutes, startMinutes, endMinutes)) {
        // 버리지 않는다 — 방해금지 종료 시각까지 이 매칭 하나만 다시 예약한다
        // (04-notification-settings.md §엣지 케이스 "방해금지 시간대에 발생한 알림의 처리 방침").
        const delay = computeDelayToQuietHoursEndMs(nowMinutes, endMinutes);
        await this.notifyQueue.add(
          'dispatch-notifications',
          { matchIds: [match.id] },
          { delay },
        );
        this.logger.log(
          `Match ${match.id}: 방해금지 시간대 — ${delay}ms 후로 재예약`,
        );
        return;
      }
    }

    await this.dispatchEmail(match, settings);
    // 웹 푸시(push_enabled) 채널은 02-07 Task 2(web-push.service.ts)에서 이 메서드 아래에 추가한다.
  }

  private async dispatchEmail(
    match: DispatchableMatch,
    settings: NonNullable<DispatchableMatch['company']['notificationSettings']>,
  ): Promise<void> {
    if (!settings.emailEnabled) return;

    // 이미 이 채널로 로그가 있으면(성공/실패 무관) 재처리하지 않는다 — 잡을 두 번 실행해도
    // notification_logs 행이 늘어나지 않는다(02-07-PLAN.md acceptance_criteria).
    const hasEmailLog = match.notificationLogs.some(
      (log) => log.channel === 'email',
    );
    if (hasEmailLog) return;

    if (settings.digestFrequency === 'daily_digest') {
      // 즉시 발송하지 않고 "일일 요약 발송 대상"으로만 표시한다 — 요약 발송 스케줄러
      // 자체는 이 플랜 범위 밖(02-07-PLAN.md Task1 action, Claude's Discretion 명시).
      await this.prisma.notificationLog.upsert({
        where: { matchId_channel: { matchId: match.id, channel: 'email' } },
        create: { matchId: match.id, channel: 'email', status: 'pending' },
        update: {},
      });
      return;
    }

    await this.notificationsService.sendEmailForMatch(match, match.company);
  }
}

/** 서버 프로세스 UTC 기준 "하루 중 몇 분째"인지 반환 — quiet_hours 비교 단위.
 *  db-schema-design.md에 업체별 타임존 컬럼이 없어 UTC를 단일 기준으로 삼는다
 *  ([ASSUMED] — 향후 타임존 컬럼 추가 시 재검토 필요, WINDOWS.md에 기록). */
export function dateToMinutesOfDay(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/**
 * 방해금지 시간대 판정(순수 함수, 분 단위 정수만 다뤄 테스트가 쉽다).
 * 자정을 넘기는 구간(start > end)도 지원한다(04-notification-settings.md §상호작용).
 * start === end는 사실상 미설정과 동일하게 취급(방해금지 없음).
 */
export function isWithinQuietHours(
  nowMinutes: number,
  startMinutes: number,
  endMinutes: number,
): boolean {
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

/** 현재 시각부터 방해금지 종료 시각까지 남은 ms(자정을 넘기는 경우 포함). */
export function computeDelayToQuietHoursEndMs(
  nowMinutes: number,
  endMinutes: number,
): number {
  let diffMinutes = endMinutes - nowMinutes;
  if (diffMinutes <= 0) diffMinutes += MINUTES_PER_DAY;
  return diffMinutes * 60 * 1000;
}
