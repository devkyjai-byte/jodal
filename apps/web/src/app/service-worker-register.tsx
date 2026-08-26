"use client";

import { useEffect } from "react";

/**
 * public/sw.js를 등록하는 클라이언트 컴포넌트.
 * 02-01 스캐폴딩 — 서비스워커 자체는 최소 install 이벤트만 처리한다.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
