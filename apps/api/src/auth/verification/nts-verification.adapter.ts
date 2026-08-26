import { Injectable } from '@nestjs/common';
import type {
  NtsVerificationPort,
  VerificationResult,
} from './nts-verification.port';

/**
 * 국세청 사업자등록정보 진위확인 API 어댑터 — 02-RESEARCH.md §Code Examples 패턴을 따른다.
 * Node 내장 fetch만 사용(신규 HTTP 클라이언트 패키지 설치 없음).
 *
 * 정확한 엔드포인트·파라미터명·응답 스키마는 활용신청 승인 후에만 확정 가능하다(RESEARCH.md
 * Open Question 2). 이 어댑터는 응답 파싱 실패를 "레코드 단위 예외"로 던진다 — 호출부인
 * AuthService.triggerVerification()이 이 예외를 잡아 verification_status를 변경하지 않고
 * 로그만 남기도록 설계되어 있다(01-onboarding.md §엣지 케이스 "진위확인 API 지연·실패").
 */
@Injectable()
export class NtsVerificationAdapter implements NtsVerificationPort {
  async verify(
    bizNo: string,
    openDate?: string,
    repName?: string,
  ): Promise<VerificationResult> {
    const apiKey = process.env.NTS_API_KEY;
    if (!apiKey) {
      throw new Error(
        'NTS_API_KEY 환경변수가 설정되지 않았습니다. env.example 참고.',
      );
    }

    const res = await fetch(
      `https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businesses: [
            { b_no: bizNo, start_dt: openDate ?? '', p_nm: repName ?? '' },
          ],
        }),
      },
    );

    if (!res.ok) {
      throw new Error(
        `국세청 진위확인 API가 ${res.status} 상태를 반환했습니다.`,
      );
    }

    const data: unknown = await res.json();
    const valid = extractValidField(data);
    if (valid === undefined) {
      throw new Error(
        '국세청 진위확인 API 응답 형식이 예상과 다릅니다 (data.data[0].valid 없음).',
      );
    }

    return valid === '01' ? 'verified' : 'failed';
  }
}

/** 응답 형식이 문서화되지 않았으므로 `any` 대신 타입 가드로 안전하게 파싱한다. */
function extractValidField(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    return undefined;
  }
  const list = payload.data;
  if (!Array.isArray(list) || list.length === 0) {
    return undefined;
  }
  const first: unknown = list[0];
  if (typeof first !== 'object' || first === null || !('valid' in first)) {
    return undefined;
  }
  const valid = first.valid;
  return typeof valid === 'string' ? valid : undefined;
}
