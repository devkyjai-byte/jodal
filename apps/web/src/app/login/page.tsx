'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, login, storeAccessToken } from '../../lib/api-client';

/**
 * 로그인 화면 — 02-02가 만든 회원가입 경로(POST /auth/signup) 이후의 재로그인 경로.
 * 이메일을 로그인 식별자로 채택한 이유는 apps/api/src/auth/auth.service.ts의
 * login() 문서 주석 참고(02-03-PLAN.md 재량 결정).
 */
export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): string | null {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return '이메일 형식이 올바르지 않습니다.';
    }
    if (password.length === 0) {
      return '비밀번호를 입력해주세요.';
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const validationError = validate();
    if (validationError) {
      setFieldError(validationError);
      return;
    }
    setFieldError(null);
    setIsSubmitting(true);

    try {
      const result = await login({ email, password });
      storeAccessToken(result.accessToken);
      router.push('/feed');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // 사용자 열거 방지 — 백엔드가 이미 이메일 미존재/비밀번호 불일치를 동일 문구로
        // 응답한다(T-02-18). 프론트도 err.message를 그대로 노출해 문구를 이원화하지 않는다.
        setSubmitError(err.message);
      } else if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-sm space-y-5"
        noValidate
      >
        <h1 className="text-2xl font-semibold">로그인</h1>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium">
            담당자 이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
          />
        </div>

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
          {isSubmitting ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}
