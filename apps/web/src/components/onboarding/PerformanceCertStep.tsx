'use client';

import { useEffect, useState } from 'react';
import {
  addCertification,
  addPerformance,
  ApiError,
  listCertifications,
  listPerformances,
  type CertificationItem,
  type PerformanceItem,
} from '../../lib/api-client';

interface PerformanceCertStepProps {
  onNext: () => void;
  onBack: () => void;
}

/**
 * 01-onboarding.md 스텝 4 — 실적·인증(선택). 반복 입력 폼 + "건너뛰기" 버튼.
 * 건너뛰기 클릭 시 API 호출 없이 즉시 스텝 5로 이동한다(§레이아웃 스텝4 "건너뛰기 가능").
 */
export default function PerformanceCertStep({
  onNext,
  onBack,
}: PerformanceCertStepProps) {
  const [performances, setPerformances] = useState<PerformanceItem[]>([]);
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projectName, setProjectName] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [contractDate, setContractDate] = useState('');
  const [agencyName, setAgencyName] = useState('');

  const [certType, setCertType] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [perfs, certs] = await Promise.all([
          listPerformances(),
          listCertifications(),
        ]);
        if (!cancelled) {
          setPerformances(perfs);
          setCertifications(certs);
        }
      } catch {
        if (!cancelled) setError('실적·인증 목록을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAddPerformance() {
    if (projectName.trim().length === 0) {
      setError('사업명을 입력해주세요.');
      return;
    }
    setError(null);
    try {
      const created = await addPerformance({
        projectName,
        contractAmount: contractAmount || undefined,
        contractDate: contractDate || undefined,
        agencyName: agencyName || undefined,
      });
      setPerformances((prev) => [...prev, created]);
      setProjectName('');
      setContractAmount('');
      setContractDate('');
      setAgencyName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '실적 등록 중 오류가 발생했습니다.');
    }
  }

  async function handleAddCertification() {
    if (certType.trim().length === 0) {
      setError('인증 종류를 입력해주세요.');
      return;
    }
    setError(null);
    try {
      const created = await addCertification({
        certType,
        certNumber: certNumber || undefined,
        expiresAt: expiresAt || undefined,
      });
      setCertifications((prev) => [...prev, created]);
      setCertType('');
      setCertNumber('');
      setExpiresAt('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '인증 등록 중 오류가 발생했습니다.');
    }
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-semibold">실적·인증 (선택)</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          지금 입력하지 않아도 괜찮습니다. 나중에 프로필 화면에서 추가할 수 있습니다.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">실적</h3>
        {!isLoading && (
          <ul className="space-y-1 text-sm">
            {performances.map((p) => (
              <li key={p.id} className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700">
                {p.projectName}
                {p.agencyName && ` · ${p.agencyName}`}
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="사업명 (필수)"
            className="col-span-2 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
          />
          <input
            type="text"
            inputMode="numeric"
            value={contractAmount}
            onChange={(e) => setContractAmount(e.target.value.replace(/\D/g, ''))}
            placeholder="계약금액"
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
          />
          <input
            type="date"
            value={contractDate}
            onChange={(e) => setContractDate(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
          />
          <input
            type="text"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="발주기관"
            className="col-span-2 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleAddPerformance()}
          className="rounded border border-zinc-400 px-3 py-1 text-sm"
        >
          실적 추가
        </button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">인증</h3>
        {!isLoading && (
          <ul className="space-y-1 text-sm">
            {certifications.map((c) => (
              <li key={c.id} className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700">
                {c.certType}
                {c.certNumber && ` · ${c.certNumber}`}
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={certType}
            onChange={(e) => setCertType(e.target.value)}
            placeholder="인증 종류 (필수)"
            className="col-span-2 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
          />
          <input
            type="text"
            value={certNumber}
            onChange={(e) => setCertNumber(e.target.value)}
            placeholder="인증 번호"
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
          />
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleAddCertification()}
          className="rounded border border-zinc-400 px-3 py-1 text-sm"
        >
          인증 추가
        </button>
      </section>

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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNext}
            className="rounded border border-zinc-400 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400"
          >
            건너뛰기
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
    </div>
  );
}
