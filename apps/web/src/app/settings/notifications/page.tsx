import { Suspense } from 'react';
import NotificationSettingsContent from './NotificationSettingsContent';

/**
 * 04-notification-settings.md 전체 구현(CLIENT-01) — 온보딩 스텝 5, 공고 상세의
 * "이 업종 알림 조정하기", 전역 내비게이션 설정 메뉴에서 진입.
 * useSearchParams()(?from=detail&hint=)를 쓰는 실제 로직은 NotificationSettingsContent
 * (클라이언트 컴포넌트)에 있다 — feed/page.tsx와 동일하게 Next.js 16 prerender 요구사항
 * (use-search-params.md §Prerendering)에 맞춰 Suspense 경계로 감싼다.
 */
export default function NotificationSettingsPage() {
  return (
    <Suspense fallback={<NotificationSettingsPageSkeleton />}>
      <NotificationSettingsContent />
    </Suspense>
  );
}

function NotificationSettingsPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <div className="h-7 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
    </div>
  );
}
