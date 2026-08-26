import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_SENDER_PORT } from './ports/email-sender.port';
import type { EmailSenderPort } from './ports/email-sender.port';

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
      try {
        await this.emailSender.send({
          to: company.contactEmail,
          subject: `[조달메이트] 새로운 매칭 공고: ${match.announcement.title}`,
          body: `${company.companyName}님, 조건에 맞는 새 공고가 등록되었습니다.\n\n${match.announcement.title}`,
        });

        // UNIQUE(match_id, channel) 기준 UPSERT — 재시도 시 새 행이 아니라 상태 갱신
        // (db-schema-design.md §스파인이 강제하는 설계 제약 (d)).
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
  }
}
