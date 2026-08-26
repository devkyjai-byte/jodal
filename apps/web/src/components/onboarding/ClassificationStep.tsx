'use client';

import { useEffect, useState } from 'react';
import {
  addClassificationCode,
  ApiError,
  deleteClassificationCode,
  listClassificationCodes,
  type ClassificationCodeItem,
} from '../../lib/api-client';
import { RECOMMENDED_CLASSIFICATION_TREE } from '../../lib/classification-tree.data';

const CODE_FORMAT = /^(\d{2}|\d{4}|\d{6}|\d{8})$/;

interface ClassificationStepProps {
  onNext: () => void;
}

/**
 * 01-onboarding.md 스텝 2 — 물품분류 대분류/중분류 다중 선택.
 * 대분류 클릭 시 아코디언으로 중분류를 펼치고, 체크박스로 다중 선택한다.
 * 선택이 바뀔 때마다 즉시 API를 호출해 저장한다(POST/DELETE) — 뒤로가기 시 로컬 상태 보존,
 * 새로고침 시 GET /companies/me/classification-codes로 재조회한다.
 */
export default function ClassificationStep({ onNext }: ClassificationStepProps) {
  const [selected, setSelected] = useState<ClassificationCodeItem[]>([]);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [customCode, setCustomCode] = useState('');
  const [customCodeError, setCustomCodeError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const codes = await listClassificationCodes();
        if (!cancelled) setSelected(codes);
      } catch {
        if (!cancelled) setLoadError('업종 목록을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCodeSet = new Set(selected.map((s) => s.classificationCode));

  async function toggleCode(code: string) {
    setPendingCode(code);
    setLoadError(null);
    try {
      if (selectedCodeSet.has(code)) {
        const target = selected.find((s) => s.classificationCode === code);
        if (target) {
          await deleteClassificationCode(target.id);
          setSelected((prev) => prev.filter((s) => s.id !== target.id));
        }
      } else {
        const created = await addClassificationCode(code);
        setSelected((prev) => [...prev, created]);
      }
      setNextError(null);
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : '저장 중 오류가 발생했습니다.',
      );
    } finally {
      setPendingCode(null);
    }
  }

  function handleCustomCodeSubmit() {
    if (!CODE_FORMAT.test(customCode)) {
      setCustomCodeError('분류코드는 2/4/6/8자리 숫자여야 합니다.');
      return;
    }
    setCustomCodeError(null);
    void toggleCode(customCode);
    setCustomCode('');
  }

  function handleNext() {
    // 업종을 하나도 선택하지 않고 "다음" 클릭 시 API 호출 없이 인라인 오류만 표시한다
    // (01-onboarding.md §상호작용/§엣지 케이스).
    if (selected.length === 0) {
      setNextError('업종을 1개 이상 선택해주세요.');
      return;
    }
    onNext();
  }

  return (
    <div className="w-full max-w-lg space-y-5">
      <div>
        <h2 className="text-xl font-semibold">업종 선택</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          선택 범위가 넓을수록(대분류만) 더 많은 공고가, 좁을수록(중분류까지) 더 적고
          정확한 공고가 매칭됩니다.
        </p>
      </div>

      <p className="text-sm font-medium">선택됨: {selected.length}개</p>

      {isLoading ? (
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      ) : (
        <ul className="space-y-3">
          {RECOMMENDED_CLASSIFICATION_TREE.map((category) => (
            <li
              key={category.name}
              className="rounded border border-zinc-300 p-3 dark:border-zinc-700"
            >
              {category.confirmed ? (
                <>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedCodeSet.has(category.code)}
                        disabled={pendingCode === category.code}
                        onChange={() => void toggleCode(category.code)}
                      />
                      <span className="font-medium">
                        {category.name} ({category.code})
                      </span>
                    </label>
                    {category.midCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCode((prev) =>
                            prev === category.code ? null : category.code,
                          )
                        }
                        className="text-sm text-zinc-600 underline dark:text-zinc-400"
                      >
                        {expandedCode === category.code ? '접기' : '펼치기'}
                      </button>
                    )}
                  </div>
                  {expandedCode === category.code && (
                    <ul className="mt-2 ml-6 space-y-1">
                      {category.midCategories.map((mid) => (
                        <li key={mid.code}>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedCodeSet.has(mid.code)}
                              disabled={pendingCode === mid.code}
                              onChange={() => void toggleCode(mid.code)}
                            />
                            {mid.name} ({mid.code})
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      코드 확인 중
                    </span>
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    아직 물품분류번호가 확정되지 않았습니다. 알고 계신 분류코드가 있다면
                    직접 입력해 등록할 수 있습니다.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customCode}
                      onChange={(e) =>
                        setCustomCode(e.target.value.replace(/\D/g, ''))
                      }
                      placeholder="예: 7215 (2/4/6/8자리)"
                      maxLength={8}
                      className="w-40 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
                    />
                    <button
                      type="button"
                      onClick={handleCustomCodeSubmit}
                      className="rounded border border-zinc-400 px-3 py-1 text-sm"
                    >
                      추가
                    </button>
                  </div>
                  {customCodeError && (
                    <p role="alert" className="text-xs text-red-600">
                      {customCodeError}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {loadError && (
        <p role="alert" className="text-sm text-red-600">
          {loadError}
        </p>
      )}
      {nextError && (
        <p role="alert" className="text-sm text-red-600">
          {nextError}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleNext}
          className="rounded bg-foreground px-4 py-2 text-background"
        >
          다음
        </button>
      </div>
    </div>
  );
}
