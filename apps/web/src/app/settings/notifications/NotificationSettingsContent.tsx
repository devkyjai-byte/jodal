'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PushSubscribeButton from '../../../components/settings/PushSubscribeButton';
import {
  NotificationLogItem,
  NotificationSettings,
  UpdateNotificationSettingsPayload,
  getAccessToken,
  getNotificationLogs,
  getNotificationSettings,
  previewNotificationCount,
  updateNotificationSettings,
} from '../../../lib/api-client';

/** toQualitativeTier(matching.service.ts)의 5단계 등급 경계값과 정확히 대응. */
const THRESHOLD_TIERS: { label: string; value: number }[] = [
  { label: '참고용', value: 0 },
  { label: '낮음', value: 35 },
  { label: '보통', value: 55 },
  { label: '적합', value: 70 },
  { label: '매우 적합', value: 85 },
];

function tierIndexForThreshold(threshold: number): number {
  let idx = 0;
  THRESHOLD_TIERS.forEach((tier, i) => {
    if (threshold >= tier.value) idx = i;
  });
  return idx;
}

const DEADLINE_DAY_OPTIONS = [1, 3, 5, 7];

const PREVIEW_DEBOUNCE_MS = 300;
const TOAST_DURATION_MS = 2500;

/**
 * 04-notification-settings.md 전체 구현.
 * - 채널(이메일/푸시) 토글 → 변경 즉시 PATCH + 토스트.
 * - 임계값 슬라이더(5단계 눈금) → 조정 중 GET .../preview로 실시간 예상 알림량 안내.
 * - 발송 빈도(즉시/일간 요약), 방해금지 시간대, 마감임박 리마인더.
 * - 이메일·푸시 모두 off로 만들려는 시도 → 확인 다이얼로그 → 확인 후에도 배너 지속 노출.
 * - 저장 실패 시 낙관적 업데이트 롤백 + 토스트.
 * - ?from=detail&hint={prefix}로 진입하면 임계값 슬라이더를 강조 표시.
 */
export default function NotificationSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightThreshold = searchParams.get('from') === 'detail';

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<NotificationLogItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    getNotificationSettings()
      .then((data) => setSettings(data))
      .catch(() => setLoadError('알림 설정을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  // 임계값 조정 중 실시간 미리보기(디바운스) — GET /notification-settings/preview?threshold=N.
  useEffect(() => {
    if (!settings) return;
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => {
      previewNotificationCount(settings.minScoreThreshold)
        .then((res) => setPreviewCount(res.count))
        .catch(() => setPreviewCount(null));
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
    // settings 객체 전체가 아니라 minScoreThreshold 값이 바뀔 때만 재조회한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.minScoreThreshold]);

  function askConfirmAllOff(): Promise<boolean> {
    setConfirmOpen(true);
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
    });
  }

  function resolveConfirm(result: boolean) {
    setConfirmOpen(false);
    confirmResolverRef.current?.(result);
    confirmResolverRef.current = null;
  }

  const applyPatch = useCallback(
    async (partial: UpdateNotificationSettingsPayload) => {
      setSettings((current) => {
        if (!current) return current;
        return { ...current, ...partial };
      });
      try {
        const updated = await updateNotificationSettings(partial);
        setSettings(updated);
        setToast('저장됨');
      } catch {
        // 낙관적 업데이트 롤백 — 저장 직전 상태를 다시 불러온다(단일 소스 유지를 위해
        // 로컬 스냅샷 대신 서버 재조회로 되돌린다).
        try {
          const reverted = await getNotificationSettings();
          setSettings(reverted);
        } catch {
          // 재조회마저 실패하면 화면 상태는 그대로 두고 토스트로만 실패를 알린다.
        }
        setToast('저장하지 못했습니다. 다시 시도해주세요.');
      }
    },
    [],
  );

  async function handleEmailToggle(next: boolean) {
    if (!settings) return;
    if (!next && !settings.pushEnabled) {
      const confirmed = await askConfirmAllOff();
      if (!confirmed) return;
    }
    void applyPatch({ emailEnabled: next });
  }

  async function handlePushBeforeToggle(): Promise<boolean> {
    if (!settings) return true;
    const nextEnabled = !settings.pushEnabled;
    if (!nextEnabled && !settings.emailEnabled) {
      return askConfirmAllOff();
    }
    return true;
  }

  function handlePushChange(nextEnabled: boolean) {
    void applyPatch({ pushEnabled: nextEnabled });
  }

  function handleTierSelect(value: number) {
    void applyPatch({ minScoreThreshold: value });
  }

  function handleFrequencyChange(value: 'immediate' | 'daily_digest') {
    void applyPatch({ digestFrequency: value });
  }

  function handleQuietHoursStartChange(value: string) {
    void applyPatch({ quietHoursStart: value === '' ? null : value });
  }

  function handleQuietHoursEndChange(value: string) {
    void applyPatch({ quietHoursEnd: value === '' ? null : value });
  }

  function handleDeadlineReminderToggle(next: boolean) {
    void applyPatch({ deadlineReminderEnabled: next });
  }

  function handleDeadlineDaysChange(days: number) {
    void applyPatch({ deadlineReminderDays: days });
  }

  async function handleShowHistory() {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && history === null) {
      setHistoryLoading(true);
      try {
        const logs = await getNotificationLogs();
        setHistory(logs);
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  if (loadError || !settings) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16 text-center">
        <p role="alert" className="text-sm text-red-600">
          {loadError ?? '알림 설정을 불러오지 못했습니다.'}
        </p>
      </div>
    );
  }

  const allOff = !settings.emailEnabled && !settings.pushEnabled;
  const tierIndex = tierIndexForThreshold(settings.minScoreThreshold);
  const quietHoursWrapsMidnight =
    !!settings.quietHoursStart &&
    !!settings.quietHoursEnd &&
    settings.quietHoursEnd < settings.quietHoursStart;

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-6">
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded bg-zinc-900 px-4 py-2 text-sm text-white shadow"
        >
          {toast}
        </div>
      )}

      <h1 className="text-xl font-semibold">알림 설정</h1>

      {allOff && (
        <div
          role="alert"
          className="rounded bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          모든 알림이 꺼져 있습니다. 새 공고를 놓칠 수 있어요.
        </div>
      )}

      {/* 채널 */}
      <section className="space-y-3 rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-medium">채널</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm">이메일 알림</span>
          <ToggleSwitch
            checked={settings.emailEnabled}
            onChange={(v) => void handleEmailToggle(v)}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-sm">푸시 알림</span>
            <p className="text-xs text-zinc-500">
              브라우저 알림 권한이 필요합니다(네이티브 앱 푸시는 추후 지원 — CLIENT-04).
            </p>
          </div>
          <PushSubscribeButton
            checked={settings.pushEnabled}
            onChange={handlePushChange}
            onBeforeToggle={handlePushBeforeToggle}
          />
        </div>
      </section>

      {/* 적합도 임계값 */}
      <section
        className={`space-y-2 rounded border p-4 ${
          highlightThreshold
            ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900'
            : 'border-zinc-200 dark:border-zinc-800'
        }`}
      >
        <h2 className="text-sm font-medium">적합도 임계값</h2>
        {highlightThreshold && (
          <p className="text-xs text-blue-700 dark:text-blue-300">
            공고 상세에서 이동했습니다 — 임계값을 조정해보세요.
          </p>
        )}
        <input
          type="range"
          min={0}
          max={THRESHOLD_TIERS.length - 1}
          step={1}
          value={tierIndex}
          onChange={(e) =>
            handleTierSelect(THRESHOLD_TIERS[Number(e.target.value)].value)
          }
          className="w-full"
          aria-label="적합도 임계값"
        />
        <div className="flex justify-between text-xs text-zinc-500">
          {THRESHOLD_TIERS.map((t) => (
            <span key={t.label}>{t.label}</span>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          이 값 이상만 알림을 보냅니다. 값을 올리면 알림이 줄고 원하는 공고를 놓칠 위험이
          커집니다.
        </p>
        <p className="text-sm">
          최근 7일 기준 약 {previewCount ?? '-'}건의 알림을 받았을 거예요.
        </p>
      </section>

      {/* 발송 빈도 */}
      <section className="space-y-2 rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-medium">발송 빈도</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="digestFrequency"
            checked={settings.digestFrequency === 'immediate'}
            onChange={() => handleFrequencyChange('immediate')}
          />
          즉시
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="digestFrequency"
            checked={settings.digestFrequency === 'daily_digest'}
            onChange={() => handleFrequencyChange('daily_digest')}
          />
          일간 요약
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            준비 중
          </span>
        </label>
        {settings.digestFrequency === 'daily_digest' && (
          <p role="alert" className="text-xs text-amber-700 dark:text-amber-400">
            일간 요약 발송 기능은 아직 준비 중입니다 — 선택 시 이메일 알림을 받지 못할 수
            있어요. 지금은 &quot;즉시&quot;를 권장합니다.
          </p>
        )}
      </section>

      {/* 방해금지 시간대 */}
      <section className="space-y-2 rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-medium">방해금지 시간대</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1">
            시작
            <input
              type="time"
              value={settings.quietHoursStart ?? ''}
              onChange={(e) => handleQuietHoursStartChange(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700"
            />
          </label>
          <label className="flex items-center gap-1">
            종료
            <input
              type="time"
              value={settings.quietHoursEnd ?? ''}
              onChange={(e) => handleQuietHoursEndChange(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700"
            />
          </label>
        </div>
        {quietHoursWrapsMidnight && (
          <p className="text-xs text-zinc-500">
            다음날 {settings.quietHoursEnd}까지, 자정을 넘기는 구간으로 저장됩니다.
          </p>
        )}
      </section>

      {/* 마감임박 리마인더 */}
      <section className="space-y-2 rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">마감임박 리마인더</h2>
          <ToggleSwitch
            checked={settings.deadlineReminderEnabled}
            onChange={handleDeadlineReminderToggle}
          />
        </div>
        {settings.deadlineReminderEnabled && (
          <label className="flex items-center gap-2 text-sm">
            며칠 전
            <select
              value={settings.deadlineReminderDays}
              onChange={(e) => handleDeadlineDaysChange(Number(e.target.value))}
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700"
            >
              {DEADLINE_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}일 전
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {settings.bounceWarning && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
          발송 실패가 반복되고 있어요 — 이메일 주소를 확인해주세요.
        </p>
      )}

      {/* 최근 발송 이력 */}
      <section className="space-y-2 rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => void handleShowHistory()}
          className="text-sm font-medium underline"
        >
          최근 발송 이력 보기 {historyOpen ? '접기' : '펼치기'}
        </button>
        {historyOpen &&
          (historyLoading ? (
            <p className="text-sm text-zinc-500">불러오는 중...</p>
          ) : history && history.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-zinc-500">
                  <th className="py-1 font-normal">채널</th>
                  <th className="py-1 font-normal">발송 시각</th>
                  <th className="py-1 font-normal">상태</th>
                </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="py-1">
                      {log.channel === 'email' ? '이메일' : '푸시'}
                    </td>
                    <td className="py-1">
                      {log.sentAt
                        ? new Date(log.sentAt).toLocaleString('ko-KR')
                        : '-'}
                    </td>
                    <td className="py-1">
                      {log.status === 'sent'
                        ? '성공'
                        : log.status === 'failed'
                          ? '실패'
                          : '대기'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-zinc-500">발송 이력이 없습니다.</p>
          ))}
      </section>

      {/* 카카오 알림톡 — v2 요구사항(NOTF-01), 이번 범위 밖임을 고지만 한다. */}
      <p className="text-xs text-zinc-500">
        카카오 알림톡 연동은 추후 지원 예정입니다.
      </p>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm space-y-4 rounded bg-background p-5 shadow-lg">
            <p className="text-sm">
              모든 알림을 끄면 새 공고를 놓칠 수 있습니다. 계속하시겠어요?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => resolveConfirm(false)}
                className="rounded border border-zinc-400 px-3 py-1.5 text-sm"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => resolveConfirm(true)}
                className="rounded bg-foreground px-3 py-1.5 text-sm text-background"
              >
                모두 끄기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? 'bg-foreground' : 'bg-zinc-300 dark:bg-zinc-700'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
