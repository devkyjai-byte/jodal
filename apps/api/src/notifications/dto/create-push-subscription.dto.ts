import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * POST /push-subscriptions 요청 바디 — 브라우저 Push API 구독 객체(endpoint/keys.p256dh/
 * keys.auth)를 그대로 받는다(02-RESEARCH.md §Common Pitfalls Pitfall 1).
 *
 * `endpoint`를 https 전용으로 제한하는 이유: notify.processor.ts가 이후 이 값으로 직접
 * `webpush.sendNotification()`(서버발 outbound HTTP 요청)을 호출한다 — 검증 없이 임의
 * 문자열을 저장하면 클라이언트가 내부망 주소 등으로 서버의 아웃바운드 요청을 유도하는
 * SSRF 유사 벡터가 될 수 있다(원래 threat_model에 없던 신규 표면 — SUMMARY Threat Flags 기록).
 * https 스킴 강제만으로 완전한 차단은 아니지만(예: https://169.254.169.254), 실제 푸시
 * 서비스(FCM/Mozilla 등)는 전부 https이므로 이 검증만으로 명백히 비정상적인 값은 걸러진다.
 */
export class CreatePushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  auth!: string;
}
