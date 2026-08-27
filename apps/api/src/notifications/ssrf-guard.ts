import { isIP } from 'node:net';
import { promises as dns } from 'node:dns';

/**
 * SSRF 방어 — T-02-21(threat_flag: outbound-ssrf-surface, 02-07-SUMMARY.md).
 *
 * 웹 푸시 구독 `endpoint`는 클라이언트가 제출한 값이지만, 서버(notify.processor.ts →
 * web-push.service.ts)가 그 값으로 실제 outbound HTTP 요청을 보낸다. `@IsUrl({protocols:
 * ['https']})` 스킴 제한만으로는 `https://169.254.169.254/...`(클라우드 메타데이터
 * 엔드포인트), `https://10.0.0.5/...`(내부망) 같은 값을 막지 못한다 — 02-secure-phase
 * 감사에서 T-02-21로 확인된 blind SSRF(응답 본문은 노출되지 않지만 sent/failed 상태값이
 * 내부 호스트 생존 여부를 알려주는 1비트 오라클이 됨).
 *
 * 2단계로 방어한다:
 * 1. `isLiteralPrivateOrReservedHost` — DTO 검증 시점(class-validator, 동기) 리터럴 IP
 *    호스트만 즉시 차단. 리터럴 IP가 아닌 도메인은 이 단계에서 통과시킨다(동기 DNS 조회
 *    불가) — 실제 실무 push 서비스(FCM/Mozilla 등)는 전부 도메인이므로 UX에 영향 없음.
 * 2. `assertPushEndpointResolvesSafe` — 발송 직전(notify.processor.ts 경유 web-push.service.ts,
 *    비동기) 실제 DNS 조회 결과 IP까지 검사해 DNS 리바인딩(구독 등록 시점엔 공개 IP였다가
 *    발송 시점에 사설 IP로 바뀌는 공격)을 막는다. 이 단계가 최종 방어선이다.
 */

const IPV4_PRIVATE_RANGES: Array<[number, number]> = [
  [ipv4ToInt('0.0.0.0'), ipv4ToInt('0.255.255.255')], // "this" network
  [ipv4ToInt('10.0.0.0'), ipv4ToInt('10.255.255.255')], // RFC1918
  [ipv4ToInt('100.64.0.0'), ipv4ToInt('100.127.255.255')], // CGNAT
  [ipv4ToInt('127.0.0.0'), ipv4ToInt('127.255.255.255')], // loopback
  [ipv4ToInt('169.254.0.0'), ipv4ToInt('169.254.255.255')], // link-local (cloud metadata: 169.254.169.254)
  [ipv4ToInt('172.16.0.0'), ipv4ToInt('172.31.255.255')], // RFC1918
  [ipv4ToInt('192.0.0.0'), ipv4ToInt('192.0.0.255')], // IETF protocol assignments
  [ipv4ToInt('192.0.2.0'), ipv4ToInt('192.0.2.255')], // TEST-NET-1
  [ipv4ToInt('192.168.0.0'), ipv4ToInt('192.168.255.255')], // RFC1918
  [ipv4ToInt('198.18.0.0'), ipv4ToInt('198.19.255.255')], // benchmark
  [ipv4ToInt('198.51.100.0'), ipv4ToInt('198.51.100.255')], // TEST-NET-2
  [ipv4ToInt('203.0.113.0'), ipv4ToInt('203.0.113.255')], // TEST-NET-3
  [ipv4ToInt('224.0.0.0'), ipv4ToInt('255.255.255.255')], // multicast + reserved
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (
    ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  );
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return IPV4_PRIVATE_RANGES.some(([lo, hi]) => value >= lo && value <= hi);
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true; // loopback / unspecified
  if (/^fe[89ab][0-9a-f]:/.test(normalized)) return true; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true; // fc00::/7 unique local
  // IPv4-mapped (::ffff:a.b.c.d) — check the embedded IPv4 address.
  const mapped = normalized.match(
    /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/,
  );
  if (mapped) return isPrivateOrReservedIpv4(mapped[1]);
  return false;
}

/** 리터럴 IP 호스트(도메인 아님)가 사설/예약 대역인지 검사한다. */
export function isPrivateOrReservedLiteralHost(host: string): boolean {
  const kind = isIP(host);
  if (kind === 4) return isPrivateOrReservedIpv4(host);
  if (kind === 6) return isPrivateOrReservedIpv6(host);
  return false; // 도메인 — 리터럴 IP가 아니므로 이 검사 대상 아님
}

export class UnsafePushEndpointError extends Error {
  constructor(host: string) {
    super(`푸시 구독 endpoint 호스트가 사설/예약 IP 대역입니다: ${host}`);
    this.name = 'UnsafePushEndpointError';
  }
}

/**
 * 발송 직전 최종 방어선 — 호스트명을 실제로 DNS 조회해 반환된 모든 주소(A/AAAA)가
 * 사설/예약 대역이 아닌지 검사한다. 도메인이 등록 시점엔 공개 IP를 가리켰다가 발송
 * 시점에 사설 IP로 바뀌는 DNS 리바인딩 공격까지 막는다.
 */
export async function assertPushEndpointResolvesSafe(
  endpoint: string,
): Promise<void> {
  const url = new URL(endpoint);
  const host = url.hostname;

  const literalKind = isIP(host);
  if (literalKind !== 0) {
    if (isPrivateOrReservedLiteralHost(host)) {
      throw new UnsafePushEndpointError(host);
    }
    return;
  }

  const records = await dns.lookup(host, { all: true, verbatim: true });
  for (const record of records) {
    const isUnsafe =
      record.family === 4
        ? isPrivateOrReservedIpv4(record.address)
        : isPrivateOrReservedIpv6(record.address);
    if (isUnsafe) {
      throw new UnsafePushEndpointError(`${host} → ${record.address}`);
    }
  }
}
