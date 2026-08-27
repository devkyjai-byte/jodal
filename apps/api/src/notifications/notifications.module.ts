import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleEmailAdapter } from './adapters/console-email.adapter';
import { ResendEmailAdapter } from './adapters/resend-email.adapter';
import { NotificationsService } from './notifications.service';
import { PushSubscriptionsController } from './push-subscriptions.controller';
import { WebPushService } from './web-push.service';
import { EMAIL_SENDER_PORT, EmailSenderPort } from './ports/email-sender.port';

/**
 * `EMAIL_ADAPTER` 환경변수로 ConsoleEmailAdapter(개발/테스트, 기본값)와
 * ResendEmailAdapter(운영) 사이에서 선택한다(02-07-PLAN.md). 별도 함수로 추출해 단위
 * 테스트(notify.processor.spec.ts)에서 NestJS 모듈 컴파일 없이 직접 검증할 수 있게 한다.
 *
 * ResendEmailAdapter를 NestJS providers 배열에 등록해 DI가 즉시 생성하게 하면
 * `RESEND_API_KEY`가 없는 환경(기본 테스트/CI)에서 생성자가 즉시 throw해 앱 부팅 자체가
 * 실패한다. 따라서 이 함수 안에서 필요할 때만 `new ResendEmailAdapter(...)`를 수동
 * 인스턴스화한다 — EMAIL_ADAPTER=console(기본값)이면 ResendEmailAdapter는 아예
 * 생성되지 않으므로 실제 Resend API 호출이 발생할 수 없다(테스트 환경 안전).
 */
export function selectEmailAdapter(
  configService: ConfigService,
): EmailSenderPort {
  const adapter = configService.get<string>('EMAIL_ADAPTER') ?? 'console';
  if (adapter === 'resend') {
    return new ResendEmailAdapter(configService);
  }
  return new ConsoleEmailAdapter();
}

@Module({
  controllers: [PushSubscriptionsController],
  providers: [
    NotificationsService,
    WebPushService,
    {
      provide: EMAIL_SENDER_PORT,
      useFactory: selectEmailAdapter,
      inject: [ConfigService],
    },
  ],
  exports: [NotificationsService, WebPushService],
})
export class NotificationsModule {}
