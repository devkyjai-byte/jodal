import { FixtureAnnouncementSourceAdapter } from './fixture-announcement-source.adapter';

describe('FixtureAnnouncementSourceAdapter', () => {
  it('reads the real fixture file relative to process.cwd(), not __dirname', async () => {
    // Regression test for a bug where __dirname-relative path resolution worked
    // under ts-jest (src/) but broke under the compiled build (dist/src/... is
    // one directory deeper), silently returning [] every poll in a real
    // `npm run build && npm run start:prod` deployment — exactly the default
    // ANNOUNCEMENT_SOURCE=fixture configuration this project currently ships
    // with. process.cwd() is stable across ts-jest, `nest start`, and
    // `node dist/main.js` (all run with cwd = apps/api), so this assertion
    // fails the same way regardless of whether the test itself runs compiled
    // or not — it only passes if the adapter actually finds real records.
    const adapter = new FixtureAnnouncementSourceAdapter();
    const records = await adapter.fetchLatest();
    expect(records.length).toBeGreaterThan(0);
  });

  it('logs and returns [] (does not throw) for a missing fixture file', async () => {
    const adapter = new FixtureAnnouncementSourceAdapter(
      'does-not-exist.json',
    );
    await expect(adapter.fetchLatest()).resolves.toEqual([]);
  });
});
