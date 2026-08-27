import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PushSubscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { EMAIL_SENDER_PORT } from './ports/email-sender.port';
import type { EmailSenderPort } from './ports/email-sender.port';

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
}
