/**
 * 국세청 사업자등록정보 진위확인 포트 — 02-RESEARCH.md Open Question 2/Assumption A3가
 * 명시하듯 정확한 엔드포인트·파라미터명이 활용신청 승인 전까지 미확정이다.
 * openDate/repName은 01-onboarding.md 스텝 1 폼이 수집하지 않는 값이라(사업자등록번호·
 * 업체명·이메일·비밀번호·동의만 수집) 선택 인자로 둔다 — AuthService는 현재 bizNo만 전달한다.
 * 02-07 이후 폼에 개업일자·대표자명 입력이 추가되면 이 포트 시그니처 변경 없이 값만 채워
 * 넘기면 된다(어댑터 교체 없이 확장 가능하도록 설계).
 */
export type VerificationResult = 'verified' | 'failed';

export interface NtsVerificationPort {
  verify(
    bizNo: string,
    openDate?: string,
    repName?: string,
  ): Promise<VerificationResult>;
}

/** NestJS DI 토큰 — 인터페이스는 런타임에 존재하지 않으므로 Symbol로 주입한다. */
export const NTS_VERIFICATION_PORT = Symbol('NTS_VERIFICATION_PORT');
