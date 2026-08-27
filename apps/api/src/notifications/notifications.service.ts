import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationSetting, Prisma, PushSubscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { EMAIL_SENDER_PORT } from './ports/email-sender.port';
import type { EmailSenderPort } from './ports/email-sender.port';

export interface NotificationSettingsResponse {
  emailEnabled: boolean;
  pushEnabled: boolean;
  minScoreThreshold: number;
  digestFrequency: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  deadlineReminderEnabled: boolean;
  deadlineReminderDays: number;
  /** 최근 이메일 발송 연속 3회 이상 실패 시 true(04-notification-settings.md §엣지 케이스). */
  bounceWarning: boolean;
}

export interface NotificationLogResponse {
  id: string;
  channel: string;
  status: string;
  sentAt: string | null;
  announcementTitle: string;
}

/**
 * quiet_hours 컬럼(Time)은 UTC 기준 시:분만 저장한다 — notify.processor.ts의
 * dateToMinutesOfDay()와 동일한 [ASSUMED] 단일 기준(업체별 타임존 컬럼 없음).
 */
function formatTimeHHMM(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function parseTimeHHMM(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, 0));
}

export interface MatchForEmail {
  id: string;
  announcement: { title: string };
}

export interface CompanyForEmail {
  companyName: string;
  contactEmail: string;
}

/**
 * db-schema-design.md §데이터 흐름 스파인 ④·⑤ 구현.
 * notification_settings를 조회해 email_enabled && score >= min_score_threshold인
 * "신규" 매칭(= 아직 channel='email' notification_logs가 없는 매칭)만 발송한다.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SENDER_PORT) private readonly emailSender: EmailSenderPort,
  ) {}

  /**
   * 매칭 1건에 대해 이메일을 발송하고 notification_logs를 UPSERT한다(`UNIQUE(match_id,
   * channel)` 기준 — db-schema-design.md §스파인이 강제하는 설계 제약 (d), 재시도해도
   * 새 행이 생기지 않고 상태만 갱신된다). 02-02의 sendMatchNotifications()(업체 단위 동기
   * 발송)와 02-07의 NotifyProcessor(BullMQ 비동기 발송) 양쪽에서 공유하는 단일 발송 경로 —
   * 두 경로가 각자 다른 이메일 발송 로직을 갖지 않도록 여기 하나로 모은다.
   */
  async sendEmailForMatch(
    match: MatchForEmail,
    company: CompanyForEmail,
  ): Promise<void> {
    try {
      await this.emailSender.send({
        to: company.contactEmail,
        subject: `[조달메이트] 새로운 매칭 공고: ${match.announcement.title}`,
        body: `${company.companyName}님, 조건에 맞는 새 공고가 등록되었습니다.\n\n${match.announcement.title}`,
      });

      await this.prisma.notificationLog.upsert({
        where: { matchId_channel: { matchId: match.id, channel: 'email' } },
        create: {
          matchId: match.id,
          channel: 'email',
          status: 'sent',
          sentAt: new Date(),
        },
        update: {
          status: 'sent',
          sentAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `Failed to send match notification for match ${match.id}: ${message}`,
      );
      await this.prisma.notificationLog.upsert({
        where: { matchId_channel: { matchId: match.id, channel: 'email' } },
        create: {
          matchId: match.id,
          channel: 'email',
          status: 'failed',
          errorMessage: message,
        },
        update: {
          status: 'failed',
          errorMessage: message,
        },
      });
    }
  }

  /**
   * 업체 단위 동기 발송 경로(02-02, 분류코드 등록 직후 즉시 매칭·발송). 임계값 이상 +
   * 이메일 채널로 아직 발송되지 않은 매칭을 모두 찾아 sendEmailForMatch()로 위임한다.
   */
  async sendMatchNotifications(companyId: string): Promise<void> {
    const settings = await this.prisma.notificationSetting.findUnique({
      where: { companyId },
    });

    // notification_settings는 회원가입 시 항상 함께 생성되므로(auth.service.ts) 정상
    // 경로에서는 null이 될 수 없다 — 방어적으로만 체크.
    if (!settings || !settings.emailEnabled) {
      return;
    }

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });

    // 임계값 이상 + 이메일 채널로 아직 발송되지 않은 매칭만 후보로 남긴다
    // (db-schema-design.md §데이터 흐름 스파인의 조인 SQL과 동일한 조건).
    const eligibleMatches = await this.prisma.match.findMany({
      where: {
        companyId,
        score: { gte: settings.minScoreThreshold },
        notificationLogs: { none: { channel: 'email' } },
      },
      include: { announcement: true },
    });

    for (const match of eligibleMatches) {
      await this.sendEmailForMatch(match, company);
    }
  }

  // --- 웹 푸시 구독 관리(MATCH-03, 02-07 Task2) ---

  /**
   * POST /push-subscriptions — 동일 endpoint 재구독 시 UPSERT(UNIQUE 제약,
   * 02-RESEARCH.md §Common Pitfalls Pitfall 1). 다른 업체가 같은 브라우저에서
   * 재구독하면 companyId가 새 소유자로 갱신된다(기기 기준 재구독은 의도된 동작).
   */
  upsertPushSubscription(
    companyId: string,
    dto: CreatePushSubscriptionDto,
  ): Promise<PushSubscription> {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        companyId,
        endpoint: dto.endpoint,
        p256dh: dto.p256dh,
        auth: dto.auth,
      },
      update: {
        companyId,
        p256dh: dto.p256dh,
        auth: dto.auth,
      },
    });
  }

  /** DELETE /push-subscriptions/:id — 소유권 검증 후 삭제(T-02-15). */
  async deletePushSubscription(companyId: string, id: string): Promise<void> {
    const row = await this.prisma.pushSubscription.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('구독을 찾을 수 없습니다.');
    }
    if (row.companyId !== companyId) {
      throw new ForbiddenException('본인 업체의 구독만 삭제할 수 있습니다.');
    }
    await this.prisma.pushSubscription.delete({ where: { id } });
  }

  // --- 알림 설정 화면(CLIENT-01, 02-07 Task3) ---

  /** GET /notification-settings — T-02-17: WHERE company_id로만 본인 행을 조회한다. */
  async getSettingsResponse(
    companyId: string,
  ): Promise<NotificationSettingsResponse> {
    const settings = await this.prisma.notificationSetting.findUniqueOrThrow({
      where: { companyId },
    });
    const bounceWarning = await this.computeBounceWarning(companyId);
    return this.toSettingsResponse(settings, bounceWarning);
  }

  /**
   * PATCH /notification-settings — 항목별 부분 갱신(04-notification-settings.md §상호작용
   * "변경 즉시 저장"). WHERE company_id로만 본인 행을 갱신한다(T-02-17).
   */
  async updateSettings(
    companyId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsResponse> {
    const data: Prisma.NotificationSettingUpdateInput = {};
    if (dto.emailEnabled !== undefined) data.emailEnabled = dto.emailEnabled;
    if (dto.pushEnabled !== undefined) data.pushEnabled = dto.pushEnabled;
    if (dto.minScoreThreshold !== undefined) {
      data.minScoreThreshold = new Prisma.Decimal(dto.minScoreThreshold);
    }
    if (dto.digestFrequency !== undefined) {
      data.digestFrequency = dto.digestFrequency;
    }
    if (dto.quietHoursStart !== undefined) {
      data.quietHoursStart =
        dto.quietHoursStart === null
          ? null
          : parseTimeHHMM(dto.quietHoursStart);
    }
    if (dto.quietHoursEnd !== undefined) {
      data.quietHoursEnd =
        dto.quietHoursEnd === null ? null : parseTimeHHMM(dto.quietHoursEnd);
    }
    if (dto.deadlineReminderEnabled !== undefined) {
      data.deadlineReminderEnabled = dto.deadlineReminderEnabled;
    }
    if (dto.deadlineReminderDays !== undefined) {
      data.deadlineReminderDays = dto.deadlineReminderDays;
    }

    const updated = await this.prisma.notificationSetting.update({
      where: { companyId },
      data,
    });
    const bounceWarning = await this.computeBounceWarning(companyId);
    return this.toSettingsResponse(updated, bounceWarning);
  }

  private toSettingsResponse(
    settings: NotificationSetting,
    bounceWarning: boolean,
  ): NotificationSettingsResponse {
    return {
      emailEnabled: settings.emailEnabled,
      pushEnabled: settings.pushEnabled,
      minScoreThreshold: Number(settings.minScoreThreshold),
      digestFrequency: settings.digestFrequency,
      quietHoursStart: settings.quietHoursStart
        ? formatTimeHHMM(settings.quietHoursStart)
        : null,
      quietHoursEnd: settings.quietHoursEnd
        ? formatTimeHHMM(settings.quietHoursEnd)
        : null,
      deadlineReminderEnabled: settings.deadlineReminderEnabled,
      deadlineReminderDays: settings.deadlineReminderDays,
      bounceWarning,
    };
  }

  /**
   * 이메일 채널 최근 발송 로그 3건이 모두 'failed'면 true(연속 실패 근사 — 전용 반송
   * 웹훅 없이 발송 실패 이력으로 근사, 02-07-PLAN.md action, Claude's Discretion).
   */
  private async computeBounceWarning(companyId: string): Promise<boolean> {
    const recentEmailLogs = await this.prisma.notificationLog.findMany({
      where: { channel: 'email', match: { companyId } },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    });
    return (
      recentEmailLogs.length >= 3 &&
      recentEmailLogs.every((l) => l.status === 'failed')
    );
  }

  /**
   * GET /notification-settings/preview?threshold=N — 최근 7일 매칭 중 threshold 이상인
   * 건수(슬라이더 "예상 알림량" 안내용, 04-notification-settings.md §상호작용).
   */
  previewCount(companyId: string, threshold: number): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.prisma.match.count({
      where: {
        companyId,
        matchedAt: { gte: sevenDaysAgo },
        score: { gte: threshold },
      },
    });
  }

  /** GET /notification-logs — 최근 발송 이력(채널·발송시각·상태), 최근 20건. */
  async listNotificationLogs(
    companyId: string,
  ): Promise<NotificationLogResponse[]> {
    const logs = await this.prisma.notificationLog.findMany({
      where: { match: { companyId } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: { match: { include: { announcement: true } } },
    });
    return logs.map((log) => ({
      id: log.id,
      channel: log.channel,
      status: log.status,
      sentAt: log.sentAt ? log.sentAt.toISOString() : null,
      announcementTitle: log.match.announcement.title,
    }));
  }
}
