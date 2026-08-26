/**
 * 임시 placeholder — 02-06이 실제 공고 피드 화면을 구현하기 전까지, 온보딩 완료 후
 * "완료" 클릭이 404 없이 도달할 수 있도록 최소 라우트만 존재한다(02-04-PLAN.md task 2
 * acceptance_criteria).
 */
export default function FeedPlaceholderPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold">공고 피드 준비 중</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          온보딩이 완료되었습니다. 맞춤 공고 피드 화면은 곧 제공됩니다.
        </p>
      </div>
    </div>
  );
}
