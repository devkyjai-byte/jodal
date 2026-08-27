import Link from 'next/link';
import type { FeedItem } from '../../lib/api-client';

/**
 * 02-feed.md §레이아웃 3 "공고 카드 리스트" — 공고명·발주기관·마감 D-day·예산금액·
 * 5단계 정성 등급 배지·매칭 근거를 렌더링한다. 절대 숫자(원점수·백분율)는 어디에도
 * 표시하지 않는다(Legal 제약) — item.qualitativeTier만 쓴다(item에 score 필드 자체가 없음).
 */

const TIER_STYLES: Record<string, string> = {
  '매우 적합': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  적합: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  보통: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  낮음: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  참고용: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

function formatDDay(bidCloseAt: string | null): string {
  if (!bidCloseAt) return '마감일 정보 없음';
  const diffMs = new Date(bidCloseAt).getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return '마감';
  if (diffDays === 0) return 'D-Day';
  return `D-${diffDays}`;
}

function formatBudget(budgetAmount: string | null): string {
  if (!budgetAmount) return '예산금액 정보 없음';
  const n = Number(budgetAmount);
  if (Number.isNaN(n)) return budgetAmount;
  return `${n.toLocaleString('ko-KR')}원`;
}

export default function AnnouncementCard({ item }: { item: FeedItem }) {
  return (
    <Link
      href={`/announcements/${item.id}`}
      className="block rounded border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium">{item.title}</h3>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
            TIER_STYLES[item.qualitativeTier] ?? TIER_STYLES['참고용']
          }`}
        >
          {item.qualitativeTier}
        </span>
      </div>

      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {item.agencyName ?? '발주기관 정보 없음'}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <span className={item.isExpired ? 'text-zinc-500' : 'font-medium text-red-600'}>
          {item.isExpired ? '마감됨' : formatDDay(item.bidCloseAt)}
        </span>
        <span className="text-zinc-600 dark:text-zinc-400">{formatBudget(item.budgetAmount)}</span>
      </div>

      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{item.matchReason}</p>

      <p className="mt-3 border-t border-zinc-100 pt-2 text-[11px] text-zinc-400 dark:border-zinc-800">
        참고용 정보 — 적합도는 프로필과의 겹침 정도를 안내할 뿐 낙찰 가능성을 보장하지 않습니다.
      </p>
    </Link>
  );
}
