'use client';

import { useState } from 'react';
import {
  clearStoredPushSubscriptionId,
  getStoredPushSubscriptionId,
  storePushSubscriptionId,
  subscribePush,
  unsubscribePush,
} from '../../lib/api-client';

interface PushSubscribeButtonProps {
  /** notification_settings.push_enabled의 현재 값 — 상위(설정 화면)가 소유하는 진실. */
  checked: boolean;
  /** 구독/해지 성공 시 상위가 push_enabled를 PATCH하도록 호출한다. */
  onChange: (nextEnabled: boolean) => void;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * VAPID 공개키(URL-safe base64)를 pushManager.subscribe()가 요구하는 Uint8Array로 변환.
 * `Uint8Array.from(...)`는 `Uint8Array<ArrayBufferLike>`로 추론되어 `applicationServerKey`가
 * 기대하는 `BufferSource`(ArrayBuffer 고정)와 타입이 어긋난다(02-02-SUMMARY.md Deviation #2와
 * 동일 성격의 Buffer/ArrayBuffer 타입 좁히기 문제) — `new Uint8Array(length)` + 인덱스 대입으로
 * 우회한다.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

/**
 * 푸시 채널 토글(MATCH-03) — 04-notification-settings.md §상호작용 "푸시 토글을 on으로
 * 변경 → 브라우저 알림 권한 요청 → 거부 시 토글을 되돌리고 안내 문구 표시".
 * 실제 push_enabled 저장(PATCH /notification-settings)은 상위 컴포넌트(02-07 Task3,
 * apps/web/app/settings/notifications)의 책임이다 — 이 컴포넌트는 브라우저 구독
 * 생명주기(권한 요청·구독 생성·서버 등록/해지)만 담당한다.
 */
export default function PushSubscribeButton({
  checked,
  onChange,
}: PushSubscribeButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setError(null);

    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('이 브라우저는 웹 푸시를 지원하지 않습니다.');
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setError('푸시 설정이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        // 04-notification-settings.md §엣지 케이스 "브라우저 푸시 권한 거부·차단" —
        // 토글을 되돌리고(상위가 checked=false 유지) 안내 문구만 표시한다.
        setError(
          '브라우저 알림 권한이 필요합니다. 브라우저 설정에서 이 사이트의 알림 권한을 허용한 뒤 다시 시도해주세요.',
        );
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('구독 정보를 가져오지 못했습니다.');
      }

      const { id } = await subscribePush({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      storePushSubscriptionId(id);
      onChange(true);
    } catch {
      setError('푸시 구독에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnsubscribe() {
    setError(null);
    setBusy(true);
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      }
      const storedId = getStoredPushSubscriptionId();
      if (storedId) {
        await unsubscribePush(storedId).catch(() => undefined); // 이미 삭제됐어도(410 정리 등) 무시
        clearStoredPushSubscriptionId();
      }
      onChange(false);
    } catch {
      setError('구독 해지에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  function handleToggle() {
    void (checked ? handleUnsubscribe() : handleSubscribe());
  }

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={busy}
        onClick={handleToggle}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? 'bg-foreground' : 'bg-zinc-300 dark:bg-zinc-700'
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
