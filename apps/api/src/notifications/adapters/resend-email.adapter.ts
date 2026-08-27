import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailMessage, EmailSenderPort } from '../ports/email-sender.port';

/**
 * 실제 프로덕션 이메일 발송 어댑터(MATCH-02) — 02-02의 ConsoleEmailAdapter를 대체한다.
 * EmailSenderPort 인터페이스는 그대로 재사용한다(02-02-PLAN.md 명시, 아키텍처 변경 없음).
 *
 * `RESEND_API_KEY`가 없으면 생성자에서 즉시 실패한다 — 단, notifications.module.ts의
 * 팩토리 프로바이더가 `EMAIL_ADAPTER=resend`일 때만 `new ResendEmailAdapter(...)`를
 * 호출하므로, 기본값(`EMAIL_ADAPTER=console`)로 실행되는 테스트/CI는 이 클래스를
 * 인스턴스화하지 않는다(T-02-16 — 키 유출 방지와도 별개로, 실제 Resend API 호출 자체가
 * 발생하지 않아야 한다는 02-07-PLAN.md acceptance_criteria 요구사항).
 */
@Injectable()
export class ResendEmailAdapter implements EmailSenderPort {
  private readonly logger = new Logger(ResendEmailAdapter.name);
  private readonly client: Resend;
  private readonly fromAddress: string;

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error(
        'RESEND_API_KEY 환경변수가 설정되지 않았습니다. EMAIL_ADAPTER=resend로 전환하려면 필수입니다(env.example 참고).',
      );
    }
    this.client = new Resend(apiKey);
    this.fromAddress =
      configService.get<string>('RESEND_FROM_ADDRESS') ??
      'notify@jodalmate.co.kr';
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.fromAddress,
      to: message.to,
      subject: message.subject,
      text: message.body,
    });

    if (error) {
      // 이메일 본문(공고명·업체 이메일)은 로그에 남기지 않는다(T-02-16) — 에러 메시지만 기록.
      this.logger.error(`Resend API error: ${error.message}`);
      throw new Error(`Resend API error: ${error.message}`);
    }
  }
}
