/**
 * Jest 전용 'meilisearch' 모듈 대체본.
 *
 * 'meilisearch' npm 패키지는 ESM 전용(package.json "type": "module", CJS 빌드 없음)이다.
 * Node 24(런타임)는 require()로 ESM 그래프를 네이티브 로드할 수 있어 실제 빌드·실행에는
 * 문제가 없지만(`node -e "require('meilisearch')"`로 확인됨), Jest의 자체 모듈 로더는 이
 * 네이티브 기능을 쓰지 않아 `SyntaxError: Unexpected token 'export'`로 테스트 스위트 전체가
 * 실패한다. 이 프로젝트의 어떤 단위테스트도 실제 Meilisearch 서버에 연결하지 않고 항상
 * MeilisearchService를 mock/fake로 대체하므로(announcements.service.spec.ts,
 * announcements.controller.spec.ts), 이 파일은 import 시점의 파싱 실패만 막으면 된다.
 * package.json의 jest.moduleNameMapper가 테스트 실행 중에만 이 파일로 치환한다 — 실제
 * `nest build`/런타임에는 영향이 없다.
 */
export class Meilisearch {
  index(): {
    addDocuments: () => Promise<unknown>;
    search: () => Promise<{ hits: unknown[] }>;
  } {
    return {
      addDocuments: () => Promise.resolve({}),
      search: () => Promise.resolve({ hits: [] }),
    };
  }
}
