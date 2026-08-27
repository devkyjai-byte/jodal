'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import FilterBar, { FilterBarValue } from '../../components/feed/FilterBar';
import AnnouncementCard from '../../components/feed/AnnouncementCard';
import {
  ApiError,
  CompanyProfile,
  FeedItem,
  getAccessToken,
  getCompanyProfile,
  getFeed,
} from '../../lib/api-client';

const DEBOUNCE_MS = 400;

const DEFAULT_FILTER: FilterBarValue = {
  keyword: '',
  classification: [],
  region: [],
  deadline: undefined,
  sort: 'score',
  includeExpired: false,
};

function parseFilterFromSearchParams(sp: URLSearchParams): FilterBarValue {
  const deadline = sp.get('deadline');
  const sort = sp.get('sort');
  return {
    keyword: sp.get('keyword') ?? '',
    classification: sp.getAll('classification'),
    region: sp.getAll('region'),
    deadline: deadline === 'this_week' || deadline === 'this_month' ? deadline : undefined,
    sort: sort === 'deadline' || sort === 'latest' ? sort : 'score',
    includeExpired: sp.get('includeExpired') === 'true',
  };
}

function filterToSearchParams(value: FilterBarValue): URLSearchParams {
  const sp = new URLSearchParams();
  if (value.keyword) sp.set('keyword', value.keyword);
  for (const c of value.classification) sp.append('classification', c);
  for (const r of value.region) sp.append('region', r);
  if (value.deadline) sp.set('deadline', value.deadline);
  if (value.sort !== 'score') sp.set('sort', value.sort);
  if (value.includeExpired) sp.set('includeExpired', 'true');
  return sp;
}

/**
 * 02-feed.md 전체 — 필터·정렬(§레이아웃 1~2), 무한 스크롤(§레이아웃 4), 카드 클릭 이동,
 * 업종 미등록/매칭 0건 구분(§엣지 케이스), 로딩 스켈레톤, 오프라인 캐시 배지·재시도.
 * ING-04, CLIENT-01, GET /feed(announcements.controller.ts)와 짝을 이룬다.
 */
export default function FeedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filter, setFilter] = useState<FilterBarValue>(() =>
    parseFilterFromSearchParams(searchParams),
  );
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [offlineNoCache, setOfflineNoCache] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    getCompanyProfile()
      .then(setProfile)
      .catch(() => {
        // 프로필 조회 실패는 여기서 별도 에러로 만들지 않는다 — 아래 items.length===0
        // 경로가 안내를 대신하며, 로그인 자체는 JWT 존재 여부로만 판단한다.
      })
      .finally(() => setProfileLoading(false));
  }, [router]);

  const loadFeed = useCallback(
    async (targetPage: number, append: boolean, filterValue: FilterBarValue) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const { data, isFromCache } = await getFeed({
          keyword: filterValue.keyword || undefined,
          classification:
            filterValue.classification.length > 0 ? filterValue.classification : undefined,
          region: filterValue.region.length > 0 ? filterValue.region : undefined,
          deadline: filterValue.deadline,
          sort: filterValue.sort,
          includeExpired: filterValue.includeExpired,
          page: targetPage,
        });
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setHasMore(data.hasMore);
        setPage(targetPage);
        setIsOffline(isFromCache);
        setOfflineNoCache(false);
      } catch (err) {
        if (!append) setItems([]);
        setHasMore(false);
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          // fetch 자체가 실패(네트워크 끊김) + sw.js 캐시도 없는 경우
          // (02-feed.md §엣지 케이스 "네트워크 오류·오프라인" — 캐시가 없으면 재시도 버튼).
          setOfflineNoCache(true);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  // 필터 변경 시 디바운스 후 재조회 + URL 쿼리스트링에 반영(스크린리더·URL 공유 대응).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const qs = filterToSearchParams(filter).toString();
      router.replace(qs ? `/feed?${qs}` : '/feed', { scroll: false });
      void loadFeed(1, false, filter);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // filter가 바뀔 때만 재조회한다 — router/loadFeed는 안정적 참조라 의도적으로 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    void loadFeed(page + 1, true, filter);
  }, [loadingMore, loading, hasMore, page, filter, loadFeed]);

  // 무한 스크롤(02-feed.md §레이아웃 4) — 리스트 끝 sentinel을 IntersectionObserver로 감지.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) handleLoadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  const registeredClassificationCodes = useMemo(
    () => profile?.classificationCodes.map((c) => c.classificationCode) ?? [],
    [profile],
  );

  // 업종 미등록(매칭 0건, 프로필 미완성) vs 매칭 0건(프로필은 있으나 결과 없음)을
  // 구분한다(02-feed.md §엣지 케이스, 두 경우를 하나로 뭉뚱그리지 않는다).
  const noClassificationRegistered =
    !profileLoading && profile !== null && profile.classificationCodes.length === 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">공고 피드</h1>

      <FilterBar
        value={filter}
        registeredClassificationCodes={registeredClassificationCodes}
        onChange={setFilter}
        onReset={() => setFilter(DEFAULT_FILTER)}
      />

      {isOffline && (
        <p
          role="status"
          className="mt-3 rounded bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900 dark:text-amber-200"
        >
          오프라인 상태 — 마지막 업데이트 기준
        </p>
      )}

      <div className="mt-4 space-y-3">
        {noClassificationRegistered ? (
          <EmptyState
            title="업종을 등록하면 맞춤 공고를 받아볼 수 있어요"
            actionHref="/onboarding"
            actionLabel="업종 등록하러 가기"
          />
        ) : loading ? (
          <FeedSkeleton />
        ) : offlineNoCache ? (
          <div className="space-y-3 rounded border border-dashed border-zinc-300 p-6 text-center text-sm dark:border-zinc-700">
            <p className="text-zinc-600 dark:text-zinc-400">
              네트워크에 연결할 수 없고, 저장된 피드도 없습니다.
            </p>
            <button
              type="button"
              onClick={() => void loadFeed(1, false, filter)}
              className="rounded border border-zinc-400 px-4 py-2"
            >
              다시 시도
            </button>
          </div>
        ) : error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : items.length === 0 ? (
          <EmptyState
            title="선택하신 업종 범위가 좁을 수 있어요"
            description="업종 선택을 넓히면 더 많은 공고를 받아볼 수 있습니다."
            actionHref="/onboarding"
            actionLabel="업종 범위 넓히기"
          />
        ) : (
          <>
            {items.map((item) => (
              <AnnouncementCard key={item.id} item={item} />
            ))}
            <div ref={sentinelRef} />
            {loadingMore && <FeedSkeleton count={1} />}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description?: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="space-y-2 rounded border border-dashed border-zinc-300 p-6 text-center text-sm dark:border-zinc-700">
      <p className="font-medium">{title}</p>
      {description && <p className="text-zinc-500">{description}</p>}
      <Link
        href={actionHref}
        className="inline-block text-blue-600 underline dark:text-blue-400"
      >
        {actionLabel}
      </Link>
    </div>
  );
}

function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}
