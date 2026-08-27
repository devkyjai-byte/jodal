import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  announcementId: string;
}

/** 410 Gone(구독 만료) — 호출자(notify.processor.ts)가 이 코드로 구독 삭제 여부를 판단한다. */
export const PUSH_SUBSCRIPTION_GONE_STATUS = 410;

/**
 * 웹 푸시(VAPID) 발송(MATCH-03) — 02-RESEARCH.md §Architecture Patterns Pattern 2.
 *
 * VAPID 키 쌍은 `.env`(VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY)에 있으면 그대로 재사용한다.
 * 없으면 이 프로세스 실행 동안만 유효한 키 쌍을 1회 생성해 경고 로그로 안내한다 — 재생성
 * (또는 프로세스 재시작으로 인한 재생성)은 그때까지 저장된 모든 push_subscriptions를
 * 무효화하므로, 실제 운영에서는 반드시 .env에 고정 보관해야 한다(02-07-PLAN.md behavior).
 */
@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private readonly publicKey: string;

  constructor(configService: ConfigService) {
    let publicKey = configService.get<string>('VAPID_PUBLIC_KEY');
    let privateKey = configService.get<string>('VAPID_PRIVATE_KEY');
    const subject =
      configService.get<string>('VAPID_SUBJECT') ??
      'mailto:support@jodalmate.co.kr';

    if (!publicKey || !privateKey) {
      const generated = webpush.generateVAPIDKeys();
      publicKey = generated.publicKey;
      privateKey = generated.privateKey;
      this.logger.warn(
        'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY가 .env에 설정되지 않아 이번 프로세스 실행에만 ' +
          '유효한 임시 키 쌍을 생성했습니다. 프로세스가 재시작되면 이 키는 사라지고, 그 사이 ' +
          '저장된 모든 push_subscriptions가 무효화됩니다. 아래 값을 .env에 저장해 고정하세요 ' +
          '(이후 재생성 시에도 기존 구독은 전부 무효화되니 신중히 다루세요): ' +
          `VAPID_PUBLIC_KEY=${publicKey}`,
      );
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.publicKey = publicKey;
  }

  /** 프론트(PushSubscribeButton.tsx)가 `pushManager.subscribe()`에 쓸 공개 키. */
  getPublicKey(): string {
    return this.publicKey;
  }

  /**
   * 구독 1건에 실제 발송한다. 410(Gone)을 포함해 실패는 그대로 throw한다 — 구독 삭제
   * 여부(410인지 판단) 및 notification_logs 기록은 호출자(notify.processor.ts)의 책임이다.
   */
  async sendNotification(
    subscription: PushSubscriptionKeys,
    payload: PushPayload,
  ): Promise<void> {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24, urgency: 'normal' },
    );
  }
}

/** notify.processor.ts가 410 여부를 판단할 때 쓰는 헬퍼 — web-push의 WebPushError만 검사. */
export function isPushSubscriptionGone(err: unknown): boolean {
  return (
    err instanceof webpush.WebPushError &&
    err.statusCode === PUSH_SUBSCRIPTION_GONE_STATUS
  );
}
