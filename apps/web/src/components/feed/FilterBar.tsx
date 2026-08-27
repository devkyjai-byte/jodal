'use client';

import { useState } from 'react';

/**
 * 02-feed.md §레이아웃 1~2 — 키워드·업종·지역·마감일 필터 바 + 정렬 선택.
 *
 * "마감일" 옵션은 02-feed.md 원문이 "이번 주/이번 달/직접 지정" 3가지를 서술하지만,
 * 02-06-PLAN.md GET /feed 쿼리 계약(action 지시)이 `deadline?(this_week|this_month)`로
 * API 파라미터를 명시적으로 한정했다 — "직접 지정"(커스텀 날짜 범위)은 이번 플랜의 API
 * 계약 밖이라 이 화면도 두 옵션만 제공한다.
 */

/** RegionStep.tsx(온보딩 스텝 3)와 동일한 17개 시/도 목록 — companies.region_codes 표기와
 * 동일해야 지역 필터가 실제로 매칭된다. */
const REGIONS = [
  '서울특별시',
  '부산광역시',
  '대구광역시',
  '인천광역시',
  '광주광역시',
  '대전광역시',
  '울산광역시',
  '세종특별자치시',
  '경기도',
  '강원특별자치도',
  '충청북도',
  '충청남도',
  '전북특별자치도',
  '전라남도',
  '경상북도',
  '경상남도',
  '제주특별자치도',
];

export type FeedSort = 'score' | 'deadline' | 'latest';
export type FeedDeadline = 'this_week' | 'this_month' | undefined;

export interface FilterBarValue {
  keyword: string;
  classification: string[];
  region: string[];
  deadline: FeedDeadline;
  sort: FeedSort;
  /** 마감이 지난 공고 포함 여부(02-feed.md §엣지 케이스 "마감이 지난 공고의 표시 방침"). */
  includeExpired: boolean;
}

interface FilterBarProps {
  value: FilterBarValue;
  /** 업체가 온보딩에서 등록한 prefix(분류코드) — 다중 선택 드롭다운의 기본 옵션. */
  registeredClassificationCodes: string[];
  onChange: (next: FilterBarValue) => void;
  onReset: () => void;
}

export default function FilterBar({
  value,
  registeredClassificationCodes,
  onChange,
  onReset,
}: FilterBarProps) {
  const [keywordInput, setKeywordInput] = useState(value.keyword);
  const [customCode, setCustomCode] = useState('');

  function submitKeyword() {
    onChange({ ...value, keyword: keywordInput.trim() });
  }

  function toggleClassification(code: string) {
    const next = value.classification.includes(code)
      ? value.classification.filter((c) => c !== code)
      : [...value.classification, code];
    onChange({ ...value, classification: next });
  }

  function addCustomClassification() {
    const trimmed = customCode.trim();
    if (!/^(\d{2}|\d{4}|\d{6}|\d{8})$/.test(trimmed)) return;
    if (!value.classification.includes(trimmed)) {
      onChange({ ...value, classification: [...value.classification, trimmed] });
    }
    setCustomCode('');
  }

  function toggleRegion(region: string) {
    const next = value.region.includes(region)
      ? value.region.filter((r) => r !== region)
      : [...value.region, region];
    onChange({ ...value, region: next });
  }

  const allClassificationOptions = Array.from(
    new Set([...registeredClassificationCodes, ...value.classification]),
  );

  return (
    <div className="w-full space-y-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      <div className="flex gap-2">
        <input
          type="search"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitKeyword();
          }}
          placeholder="공고명 키워드로 검색"
          aria-label="키워드 검색"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-black"
        />
        <button
          type="button"
          onClick={submitKeyword}
          aria-label="검색"
          className="rounded border border-zinc-400 px-3 py-2 text-sm"
        >
          검색
        </button>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">
          업종 필터 {value.classification.length > 0 && `(${value.classification.length})`}
        </summary>
        <div className="mt-2 space-y-2">
          <ul className="flex flex-wrap gap-2">
            {allClassificationOptions.map((code) => (
              <li key={code}>
                <label className="flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700">
                  <input
                    type="checkbox"
                    checked={value.classification.includes(code)}
                    onChange={() => toggleClassification(code)}
                  />
                  {code}
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.replace(/\D/g, ''))}
              placeholder="다른 분류코드 임시 추가"
              maxLength={8}
              className="w-40 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-black"
            />
            <button
              type="button"
              onClick={addCustomClassification}
              className="rounded border border-zinc-400 px-2 py-1 text-xs"
            >
              추가
            </button>
          </div>
        </div>
      </details>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">
          지역 필터 {value.region.length > 0 && `(${value.region.length})`}
        </summary>
        <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
          {REGIONS.map((region) => (
            <li key={region}>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={value.region.includes(region)}
                  onChange={() => toggleRegion(region)}
                />
                {region}
              </label>
            </li>
          ))}
        </ul>
      </details>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">
          마감일
          <select
            value={value.deadline ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                deadline: (e.target.value || undefined) as FeedDeadline,
              })
            }
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-black"
          >
            <option value="">전체</option>
            <option value="this_week">이번 주</option>
            <option value="this_month">이번 달</option>
          </select>
        </label>

        <label className="flex items-center gap-1">
          정렬
          <select
            value={value.sort}
            onChange={(e) => onChange({ ...value, sort: e.target.value as FeedSort })}
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-black"
          >
            <option value="score">적합도순</option>
            <option value="deadline">마감임박순</option>
            <option value="latest">최신 등록순</option>
          </select>
        </label>

        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.includeExpired}
            onChange={(e) => onChange({ ...value, includeExpired: e.target.checked })}
          />
          마감된 공고 포함
        </label>

        <button
          type="button"
          onClick={() => {
            setKeywordInput('');
            setCustomCode('');
            onReset();
          }}
          className="ml-auto text-xs text-zinc-500 underline dark:text-zinc-400"
        >
          필터 초기화
        </button>
      </div>
    </div>
  );
}
