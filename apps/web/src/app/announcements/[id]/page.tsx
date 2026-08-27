import { Suspense } from 'react';
import DetailContent from './DetailContent';

/**
 * 03-detail.md 전체 구현 — 공고 피드 카드 클릭 또는 이메일 알림 링크(match_id 쿼리)에서
 * 진입한다. 실제 로직은 useSearchParams()/useParams()를 쓰는 DetailContent(클라이언트
 * 컴포넌트)에 있다 — feed/page.tsx와 동일하게 Next.js 공식 권장 Suspense 경계로 감싼다.
 */
export default function AnnouncementDetailPage() {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <DetailContent />
    </Suspense>
  );
}

function DetailPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
      <div className="h-7 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-10 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-40 animate-pulse rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
    </div>
  );
}
