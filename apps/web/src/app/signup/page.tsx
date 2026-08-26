'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, signup, storeAccessToken } from '../../lib/api-client';

/**
 * 사업자등록번호 임시 입력값을 세션 동안만 보존한다(탭을 닫으면 사라짐 — localStorage가
 * 아니라 sessionStorage를 쓰는 이유). 02-03-PLAN.md의 "재방문 시 마스킹" 요구를, 이 플랜의
 * 파일 범위(신규 백엔드 프로필 조회 엔드포인트 없음)에서 구현 가능한 형태로 좁힌 재량 결정 —
 * 뒤 7자리는 세션 저장소에만 남고 화면에는 마스킹 문자열만 렌더링한다(§상호작용).
 */
const BIZ_NO_DRAFT_KEY = 'jodalmate_signup_biz_no_draft';

function maskBusinessRegNo(bizNo: string): string {
  return `${bizNo.slice(0, 3)}-**-*****`;
}

/**
 * sessionStorage 초안 읽기 — useState의 lazy initializer로만 호출한다(마운트 시 1회).
 * useEffect 안에서 setState를 직접 호출하지 않기 위한 의도적 선택
 * (react-hooks/set-state-in-effect 린트 규칙 — 캐스케이딩 렌더 방지).
 * 서버 프리렌더(window 없음)에서는 항상 빈 값을 반환하므로, 초안이 있는 재방문
 * 사용자의 첫 클라이언트 렌더에서만 하이드레이션 후 값이 채워진다(허용 가능한 트레이드오프).
 */
function readBizNoDraft(): string | null {
  if (typeof window === 'undefined') return null;
  const draft = window.sessionStorage.getItem(BIZ_NO_DRAFT_KEY);
  return draft && /^\d{10}$/.test(draft) ? draft : null;
}

/**
 * 01-onboarding.md 스텝 1 — 사업자등록번호·업체명·이메일·비밀번호·개인정보 동의.
 * 사업자등록번호 마스킹 재노출, 409(중복 가입) 전용 안내는 02-03 이후 범위.
 * 스텝 2~5(업종·지역·실적·인증·알림설정)는 02-04-PLAN.md가 /onboarding 라우트로 구현했다 —
 * 가입 성공 화면에서 그 라우트로 넘어갈 링크가 없으면 온보딩이 UI로 도달 불가능해지므로
 * [Rule 2 - Missing Critical] 이 링크를 추가한다(02-02가 남긴 스텁, 02-04-SUMMARY.md 참고).
 */
export default function SignupPage() {
  const [businessRegNo, setBusinessRegNo] = useState(() => readBizNoDraft() ?? '');
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [password, setPassword] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);

  // 재방문(같은 탭에서 뒤로 왔다 다시 방문 등) 시 이전에 입력한 사업자등록번호를
  // 마스킹된 상태로만 노출한다 — 평문 재노출 금지(§엣지 케이스).
  const [isBizNoMasked, setIsBizNoMasked] = useState(() => readBizNoDraft() !== null);

  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDuplicateError, setIsDuplicateError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupSucceeded, setSignupSucceeded] = useState(false);

  function handleBusinessRegNoChange(value: string) {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
    setBusinessRegNo(digitsOnly);
    if (digitsOnly.length === 10) {
      window.sessionStorage.setItem(BIZ_NO_DRAFT_KEY, digitsOnly);
    } else {
      window.sessionStorage.removeItem(BIZ_NO_DRAFT_KEY);
    }
  }

  function handleReenterBusinessRegNo() {
    setIsBizNoMasked(false);
    setBusinessRegNo('');
    window.sessionStorage.removeItem(BIZ_NO_DRAFT_KEY);
  }

  function validate(): string | null {
    if (!/^\d{10}$/.test(businessRegNo)) {
      return '사업자등록번호는 숫자 10자리로 입력해주세요.';
    }
    if (companyName.trim().length === 0) {
      return '업체명을 입력해주세요.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return '이메일 형식이 올바르지 않습니다.';
    }
    if (password.length < 8) {
      return '비밀번호는 8자 이상이어야 합니다.';
    }
    if (!privacyConsent) {
      return '개인정보 수집·이용에 동의해주세요.';
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setIsDuplicateError(false);

    // 동의 미체크·형식 오류 시 인라인 오류만 표시하고 API 호출 자체를 막는다
    // (01-onboarding.md 엣지 케이스).
    const validationError = validate();
    if (validationError) {
      setFieldError(validationError);
      return;
    }
    setFieldError(null);
    setIsSubmitting(true);

    try {
      const result = await signup({
        businessRegNo,
        companyName,
        contactEmail,
        password,
        privacyConsent,
      });
      storeAccessToken(result.accessToken);
      // 가입 완료 — 로컬에 남겨둔 사업자등록번호 초안은 더 이상 필요 없다.
      window.sessionStorage.removeItem(BIZ_NO_DRAFT_KEY);
      setSignupSucceeded(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setIsDuplicateError(true);
        setSubmitError('이미 등록된 사업자등록번호입니다. 로그인하시겠어요?');
      } else if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (signupSucceeded) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold">가입이 완료되었습니다</h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            이어서 업종·지역 등록을 진행해주세요.
          </p>
          <Link
            href="/onboarding"
            className="mt-6 inline-block rounded bg-foreground px-4 py-2 text-background"
          >
            프로필 등록 계속하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-sm space-y-5"
        noValidate
      >
        <h1 className="text-2xl font-semibold">업체 회원가입</h1>

        <div className="space-y-1">
          <label htmlFor="businessRegNo" className="block text-sm font-medium">
            사업자등록번호
          </label>
          {isBizNoMasked ? (
            <div className="flex items-center gap-2">
              <input
                id="businessRegNo"
                name="businessRegNo"
                type="text"
                readOnly
                value={maskBusinessRegNo(businessRegNo)}
                aria-label="사업자등록번호 (마스킹됨)"
                className="w-full rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={handleReenterBusinessRegNo}
                className="shrink-0 whitespace-nowrap text-sm underline"
              >
                다시 입력
              </button>
            </div>
          ) : (
            <input
              id="businessRegNo"
              name="businessRegNo"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={businessRegNo}
              onChange={(e) => handleBusinessRegNoChange(e.target.value)}
              maxLength={10}
              placeholder="1234567890 (하이픈 없이 10자리)"
              className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
            />
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="companyName" className="block text-sm font-medium">
            업체명
          </label>
          <input
            id="companyName"
            name="companyName"
            type="text"
            autoComplete="organization"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="contactEmail" className="block text-sm font-medium">
            담당자 이메일
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            autoComplete="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium">
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
          />
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={privacyConsent}
            onChange={(e) => setPrivacyConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>개인정보 수집·이용에 동의합니다. (필수)</span>
        </label>

        {fieldError && (
          <p role="alert" className="text-sm text-red-600">
            {fieldError}
          </p>
        )}
        {submitError && (
          <p role="alert" className="text-sm text-red-600">
            {submitError}
            {isDuplicateError && (
              <>
                {' '}
                <Link href="/login" className="underline">
                  로그인하기
                </Link>
              </>
            )}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {isSubmitting ? '가입 중...' : '가입하기'}
        </button>
      </form>
    </div>
  );
}
