'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AnnouncementDetail,
  ApiError,
  getAccessToken,
  getAnnouncementDetail,
  isAnnouncementSaved,
  toggleAnnouncementSaved,
} from '../../../lib/api-client';
import { RECOMMENDED_CLASSIFICATION_TREE } from '../../../lib/classification-tree.data';

/** 2자리 대분류 코드 → 한글 업종명. "물품분류코드와 분류명" 표시(03-detail.md §레이아웃 3)용. */
function classificationLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const prefix = code.slice(0, 2);
  const category = RECOMMENDED_CLASSIFICATION_TREE.find((c) => c.code === prefix);
  return category?.name ?? null;
}

function formatBudget(budgetAmount: string | null | undefined): string {
  if (!budgetAmount) return '정보 없음';
  const n = Number(budgetAmount);
  if (Number.isNaN(n)) return budgetAmount;
  return `${n.toLocaleString('ko-KR')}원`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '정보 없음';
  return new Date(iso).toLocaleString('ko-KR');
}

function formatDDay(bidCloseAt: string | null | undefined, isExpired: boolean | undefined): string {
  if (isExpired) return '마감됨';
  if (!bidCloseAt) return '정보 없음';
  const diffDays = Math.ceil(
    (new Date(bidCloseAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays <= 0) return 'D-Day';
  return `D-${diffDays}`;
}

/**
 * 03-detail.md 전체 구현.
 * - 헤더 바로 아래 above-the-fold에 나라장터 원문 링크 버튼 고정 배치(T-01-15 필수 요소).
 * - 참가자격 원문 발췌: bid_announcements 스키마(db-schema-design.md)에 별도 텍스트 컬럼이
 *   없어(원문은 raw_payload에만 있고 이 화면은 raw_payload를 통째로 노출하지 않는다) 이
 *   섹션은 항상 "정보 없음 — 원문에서 확인해주세요"로 표시한다. 실제 파싱·저장은 이
 *   플랜 범위 밖의 스키마 변경이 필요해 SUMMARY.md Known Stubs에 기록한다.
 * - 4개 엣지 케이스(마감/개정/파싱실패/취소삭제)를 모두 처리한다.
 */
export default function DetailContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const matchId = searchParams.get('match_id') ?? undefined;

  const [detail, setDetail] = useState<AnnouncementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullEligibility, setShowFullEligibility] = useState(false);
  const [showMatchDetail, setShowMatchDetail] = useState(false);
  // "저장됨" 여부는 매번 localStorage에서 직접 읽는다(순수 동기 읽기라 상태로 미러링할
  // 필요가 없다) — saveVersion은 toggleAnnouncementSaved() 이후 재렌더를 트리거하는
  // 용도로만 쓴다. useEffect 안에서 setState를 동기 호출하는 패턴(react-hooks lint 경고)을
  // 피하면서, params.id가 바뀌어도(개정 배너 클릭 등) 항상 최신 값을 다시 계산한다.
  const [saveVersion, setSaveVersion] = useState(0);
  const saved = saveVersion >= 0 && isAnnouncementSaved(params.id);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    getAnnouncementDetail(params.id, matchId)
      .then((data) => setDetail(data))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('공고 정보를 불러오지 못했습니다.');
        }
      })
      .finally(() => setLoading(false));
  }, [params.id, matchId, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleToggleSave() {
    const next = toggleAnnouncementSaved(params.id);
    setSaveVersion((v) => v + 1);
    setToast(next ? '저장되었습니다. 저장 목록에서 다시 찾을 수 있어요.' : '저장이 취소되었습니다.');
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  // 엣지 케이스 — 다른 업체의 match_id로 접근(T-01-16, 403).
  if (forbidden) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-16 text-center">
        <p className="font-medium">이 공고에 접근할 수 없습니다.</p>
        <p className="text-sm text-zinc-500">
          본인 업체의 매칭 정보로만 상세를 조회할 수 있습니다.
        </p>
        <Link href="/feed" className="inline-block text-blue-600 underline dark:text-blue-400">
          피드로 돌아가기
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
        <Link href="/feed" className="mt-3 inline-block text-blue-600 underline dark:text-blue-400">
          피드로 돌아가기
        </Link>
      </div>
    );
  }

  // 엣지 케이스 — 취소·삭제된 공고(found:false). 나머지 상세 영역은 렌더링하지 않는다.
  if (!detail || !detail.found) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-16 text-center">
        <p className="font-medium">이 공고는 취소되었거나 더 이상 조회할 수 없습니다.</p>
        <Link href="/feed" className="inline-block text-blue-600 underline dark:text-blue-400">
          피드로 돌아가기
        </Link>
      </div>
    );
  }

  const label = classificationLabel(detail.classificationCode);
  const hasParsingGaps = detail.hasParsingGaps ?? false;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded bg-zinc-900 px-4 py-2 text-sm text-white shadow"
        >
          {toast}
        </div>
      )}

      {/* 1. 헤더 */}
      <div>
        <h1 className="text-xl font-semibold">{detail.title}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          나라장터 공고번호 {detail.sourceBidNo ?? '정보 없음'}
          {detail.sourceRevisionNo ? ` (개정 차수 ${detail.sourceRevisionNo})` : ''} ·{' '}
          {detail.agencyName ?? '정보 없음'}
        </p>
        <div className="mt-2 flex items-center gap-2 text-sm">
          {detail.isExpired && (
            <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              마감됨
            </span>
          )}
          <span className="font-medium text-red-600">
            {formatDDay(detail.bidCloseAt, detail.isExpired)}
          </span>
        </div>
      </div>

      {/* 엣지 케이스 — 개정된 공고: 최신 차수 보기 배너 */}
      {!detail.isLatestRevision && detail.latestRevisionId && (
        <div className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          이 공고는 개정되었습니다 —{' '}
          <Link href={`/announcements/${detail.latestRevisionId}`} className="underline">
            최신 공고 보기
          </Link>
        </div>
      )}

      {/* 2. 나라장터 원문 링크 버튼 — 필수 요소, 스크롤 없이 뷰포트 안(T-01-15). */}
      <a
        href={detail.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`block w-full rounded border px-4 py-3 text-center font-medium ${
          hasParsingGaps
            ? 'border-amber-500 text-amber-700 dark:text-amber-300'
            : 'border-zinc-400'
        }`}
      >
        나라장터 원문에서 확인하기
      </a>

      {/* 3. 핵심 요약 표 */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <dt className="text-zinc-500">물품분류코드</dt>
        <dd>
          {detail.classificationCode
            ? `${detail.classificationCode}${label ? ` (${label})` : ''}`
            : '정보 없음'}
        </dd>
        <dt className="text-zinc-500">참가가능지역</dt>
        <dd>{detail.regionCodes && detail.regionCodes.length > 0 ? detail.regionCodes.join(', ') : '전국(제한 없음)'}</dd>
        <dt className="text-zinc-500">예산금액</dt>
        <dd>{formatBudget(detail.budgetAmount)}</dd>
        <dt className="text-zinc-500">계약방법</dt>
        <dd>정보 없음</dd>
        <dt className="text-zinc-500">공고 게시일</dt>
        <dd>{formatDateTime(detail.bidOpenAt)}</dd>
      </dl>

      {/* 4. 참가자격 원문 발췌 — bid_announcements에 저장된 필드가 없어 항상 "정보 없음"이다. */}
      <div className="rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setShowFullEligibility((v) => !v)}
          className="font-medium underline"
        >
          참가자격 원문 발췌 {showFullEligibility ? '접기' : '더 보기'}
        </button>
        {showFullEligibility && (
          <p className="mt-2 text-zinc-500">
            정보 없음 — 참가자격 원문 발췌는 아직 저장되지 않습니다. 위 &quot;나라장터
            원문에서 확인하기&quot; 버튼으로 원문을 확인해주세요.
          </p>
        )}
      </div>

      {/* 5. 매칭 근거 영역 */}
      <div className="rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setShowMatchDetail((v) => !v)}
          className="font-medium underline"
        >
          매칭 근거 {showMatchDetail ? '접기' : '자세히'}
        </button>
        {showMatchDetail && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
            <li>{detail.matchReason ?? '등록하신 프로필과 매칭되었습니다.'}</li>
            <li>지역 조건: {detail.regionMatched ? '일치' : '불일치'}</li>
          </ul>
        )}
      </div>

      {/* 6. 하단 액션 */}
      <div className="flex flex-wrap gap-2">
        <a
          href={detail.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-zinc-400 px-4 py-2 text-sm"
        >
          원문에서 입찰 참여하기
        </a>
        <button
          type="button"
          onClick={handleToggleSave}
          className="rounded border border-zinc-400 px-4 py-2 text-sm"
        >
          {saved ? '저장됨' : '이 공고 저장'}
        </button>
        <Link
          href={`/settings/notifications?from=detail&hint=${encodeURIComponent(
            detail.matchedPrefix ?? detail.classificationCode ?? '',
          )}`}
          className="rounded border border-zinc-400 px-4 py-2 text-sm"
        >
          이 업종 알림 조정하기
        </Link>
      </div>

      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-blue-600 underline dark:text-blue-400"
      >
        피드로 돌아가기
      </button>

      {/* 7. 고지 문구 — PROJECT.md Legal 제약 고정 배치. */}
      <p className="border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
        조달메이트는 정보 제공·보조 도구이며, 입찰 참여 전 반드시 나라장터 원문을
        확인하시기 바랍니다.
      </p>
    </div>
  );
}
