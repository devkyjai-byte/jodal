'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '../../lib/api-client';
import ClassificationStep from '../../components/onboarding/ClassificationStep';
import RegionStep from '../../components/onboarding/RegionStep';
import PerformanceCertStep from '../../components/onboarding/PerformanceCertStep';
import NotificationInitialStep from '../../components/onboarding/NotificationInitialStep';

const TOTAL_STEPS = 5;
type OnboardingStep = 2 | 3 | 4 | 5;

/**
 * 01-onboarding.md 단일 라우트 — React 상태로 5스텝 진행을 관리한다.
 * 스텝 1(계정·사업자 정보)은 02-02의 /signup이 이미 처리한다. 이 페이지는 스텝 2(업종)~
 * 스텝 5(알림 초기설정)를 연결한다(02-04-PLAN.md task 1: 스텝 2~3, task 2: 스텝 4~5).
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(2);

  useEffect(() => {
    // JWT 없이 온보딩에 진입하면 회원가입 화면으로 되돌린다.
    if (!getAccessToken()) {
      router.replace('/signup');
    }
  }, [router]);

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <p className="mb-6 text-sm font-medium text-zinc-500">
        {step}/{TOTAL_STEPS}
      </p>

      {step === 2 && <ClassificationStep onNext={() => setStep(3)} />}
      {step === 3 && (
        <RegionStep onNext={() => setStep(4)} onBack={() => setStep(2)} />
      )}
      {step === 4 && (
        <PerformanceCertStep
          onNext={() => setStep(5)}
          onBack={() => setStep(3)}
        />
      )}
      {step === 5 && <NotificationInitialStep onBack={() => setStep(4)} />}
    </div>
  );
}
