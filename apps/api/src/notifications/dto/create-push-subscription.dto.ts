import {
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';
import { isPrivateOrReservedLiteralHost } from '../ssrf-guard';

/**
 * T-02-21(SSRF) 리터럴 IP 차단 — `https://169.254.169.254/...`, `https://10.0.0.5/...`
 * 처럼 호스트가 리터럴 IP인 경우 사설/예약 대역이면 즉시 거부한다. 도메인 호스트는 동기
 * DTO 검증 시점엔 DNS 조회가 불가하므로 여기서는 통과시키고, 발송 직전
 * `assertPushEndpointResolvesSafe`(ssrf-guard.ts)가 실제 DNS 리바인딩까지 최종 검사한다.
 */
@ValidatorConstraint({ name: 'notPrivateOrReservedHost', async: false })
class NotPrivateOrReservedHostConstraint
  implements ValidatorConstraintInterface
{
  validate(value: string): boolean {
    try {
      return !isPrivateOrReservedLiteralHost(new URL(value).hostname);
    } catch {
      return true; // URL 파싱 자체는 @IsUrl이 담당 — 여기선 통과시켜 중복 에러 방지
    }
  }

  defaultMessage(): string {
    return 'endpoint host는 사설/예약 IP 대역일 수 없습니다';
  }
}

/**
 * POST /push-subscriptions 요청 바디 — 브라우저 Push API 구독 객체(endpoint/keys.p256dh/
 * keys.auth)를 그대로 받는다(02-RESEARCH.md §Common Pitfalls Pitfall 1).
 *
 * `endpoint`를 https 전용으로 제한하는 이유: notify.processor.ts가 이후 이 값으로 직접
 * `webpush.sendNotification()`(서버발 outbound HTTP 요청)을 호출한다 — 검증 없이 임의
 * 문자열을 저장하면 클라이언트가 내부망 주소 등으로 서버의 아웃바운드 요청을 유도하는
 * SSRF 벡터가 될 수 있다(원래 threat_model에 없던 신규 표면 — SUMMARY Threat Flags 기록,
 * 02-secure-phase 감사에서 T-02-21로 확인·수정). https 스킴 강제 + 리터럴 사설/예약 IP
 * 차단(NotPrivateOrReservedHostConstraint)에 더해, 발송 직전 DNS 재검사
 * (ssrf-guard.ts의 assertPushEndpointResolvesSafe)가 최종 방어선이다.
 */
export class CreatePushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Validate(NotPrivateOrReservedHostConstraint)
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
