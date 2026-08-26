'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface NotificationInitialStepProps {
  onBack: () => void;
}

/**
 * 01-onboarding.md 스텝 5 — 알림 채널 초기 설정.
 * 02-02가 가입 시 이미 만든 기본 notification_settings(이메일 on)를 읽기 전용으로 요약해
 * 보여준다 — 이 스텝에서 새 알림 설정 API를 만들지 않는다(그 소유권은 02-07,
 * apps/web/src/app/settings/notifications 라우트). "완료" 클릭 시 /feed로 이동한다.
 */
export default function NotificationInitialStep({
  onBack,
}: NotificationInitialStepProps) {
  const router = useRouter();

  function handleComplete() {
    router.push('/feed');
  }

  return (
    <div className="w-full max-w-lg space-y-6 text-center">
      <div>
        <h2 className="text-xl font-semibold">알림 채널 초기 설정</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          가입 시 이메일 알림이 기본으로 켜져 있습니다. 세부 설정(푸시·임계값 등)은 나중에
          알림 설정 화면에서 변경할 수 있습니다.
        </p>
      </div>

      <div className="rounded border border-zinc-300 px-4 py-3 text-left text-sm dark:border-zinc-700">
        <p>이메일 알림: <span className="font-medium">켜짐 (기본값)</span></p>
      </div>

      <Link
        href="/settings/notifications"
        className="inline-block text-sm text-zinc-600 underline dark:text-zinc-400"
      >
        알림 설정 화면으로 이동
      </Link>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-zinc-400 px-4 py-2"
        >
          이전
        </button>
        <button
          type="button"
          onClick={handleComplete}
          className="rounded bg-foreground px-4 py-2 text-background"
        >
          완료
        </button>
      </div>
    </div>
  );
}
