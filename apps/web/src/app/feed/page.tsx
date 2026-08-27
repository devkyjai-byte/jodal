import { Suspense } from 'react';
import FeedContent from './FeedContent';

/**
 * 02-feed.md 전체 구현 — 온보딩 완료 직후 자동 이동, 로그인 후 기본 진입 화면.
 * useSearchParams()를 쓰는 실제 로직은 FeedContent(클라이언트 컴포넌트)에 있다 —
 * Next.js 공식 문서(use-search-params.md §Prerendering)가 권장하는 대로 Suspense
 * 경계로 감싸 prerender 시 빌드 에러를 피한다.
 */
export default function FeedPage() {
  return (
    <Suspense fallback={<FeedPageSkeleton />}>
      <FeedContent />
    </Suspense>
  );
}

function FeedPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="h-7 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
    </div>
  );
}
