'use client';

import { useEffect, useState } from 'react';
import { ApiError, getCompanyProfile, updateRegionCodes } from '../../lib/api-client';

/** 17개 시/도 — VARCHAR(10) 컬럼에 맞는 전체 명칭 그대로 저장한다. */
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

interface RegionStepProps {
  onNext: () => void;
  onBack: () => void;
}

/**
 * 01-onboarding.md 스텝 3 — 활동 지역(시/도) 다중 선택.
 * 선택이 바뀔 때마다 PATCH /companies/me로 즉시 저장하고, GET /companies/me로 재조회한다
 * (02-04-PLAN.md action: "RegionStep은 신규 GET /companies/me로 각각 재조회한다").
 */
export default function RegionStep({ onNext, onBack }: RegionStepProps) {
  const [regionCodes, setRegionCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRegion, setPendingRegion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profile = await getCompanyProfile();
        if (!cancelled) setRegionCodes(profile.regionCodes);
      } catch {
        if (!cancelled) setError('지역 정보를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleRegion(region: string) {
    const next = regionCodes.includes(region)
      ? regionCodes.filter((r) => r !== region)
      : [...regionCodes, region];

    setPendingRegion(region);
    setError(null);
    try {
      await updateRegionCodes(next);
      // 저장 직후 재조회 — RegionStep의 새로고침 유지 요구를 GET /companies/me로 만족한다.
      const profile = await getCompanyProfile();
      setRegionCodes(profile.regionCodes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setPendingRegion(null);
    }
  }

  return (
    <div className="w-full max-w-lg space-y-5">
      <div>
        <h2 className="text-xl font-semibold">활동 지역</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          시/도 단위로 다중 선택할 수 있습니다.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {REGIONS.map((region) => (
            <li key={region}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={regionCodes.includes(region)}
                  disabled={pendingRegion === region}
                  onChange={() => void toggleRegion(region)}
                />
                {region}
              </label>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-zinc-400 px-4 py-2"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded bg-foreground px-4 py-2 text-background"
        >
          다음
        </button>
      </div>
    </div>
  );
}
