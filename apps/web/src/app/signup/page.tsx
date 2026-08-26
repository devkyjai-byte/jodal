'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ApiError, signup, storeAccessToken } from '../../lib/api-client';

/**
 * 01-onboarding.md 스텝 1 — 사업자등록번호·업체명·이메일·비밀번호·개인정보 동의.
 * 사업자등록번호 마스킹 재노출, 409(중복 가입) 전용 안내는 02-03 이후 범위.
 * 스텝 2~5(업종·지역·실적·인증·알림설정)는 02-04-PLAN.md가 /onboarding 라우트로 구현했다 —
 * 가입 성공 화면에서 그 라우트로 넘어갈 링크가 없으면 온보딩이 UI로 도달 불가능해지므로
 * [Rule 2 - Missing Critical] 이 링크를 추가한다(02-02가 남긴 스텁, 02-04-SUMMARY.md 참고).
 */
export default function SignupPage() {
  const [businessRegNo, setBusinessRegNo] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [password, setPassword] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);

  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupSucceeded, setSignupSucceeded] = useState(false);

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
      setSignupSucceeded(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSubmitError(
          '이미 등록된 사업자등록번호입니다. 로그인해주세요.',
        );
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
          <input
            id="businessRegNo"
            name="businessRegNo"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={businessRegNo}
            onChange={(e) => setBusinessRegNo(e.target.value.replace(/\D/g, ''))}
            maxLength={10}
            placeholder="1234567890 (하이픈 없이 10자리)"
            className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
          />
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
