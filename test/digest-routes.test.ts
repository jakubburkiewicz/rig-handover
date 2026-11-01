import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const line = (at: string, job: string, status: string) => JSON.stringify({ at, job, status, owner: 'rook' });

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(
    join(runsDir, '2026-01-01.jsonl'),
    [
      line('2026-01-01T01:00:00+01:00', 'zeta/job', 'ok'),
      line('2026-01-01T01:01:00+01:00', 'alpha/job', 'ok'),
      line('2026-01-01T01:02:00+01:00', 'mid/job', 'fail'),
    ].join('\n') + '\n',
  );
  writeFileSync(join(runsDir, '2026-01-02.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-01-03.jsonl'),
    [line('2026-01-03T01:00:00+01:00', 'alpha/job', 'ok'), 'not json at all', line('2026-01-03T01:01:00+01:00', 'beta/job', 'ok')].join('\n') + '\n',
  );
  app = createApp({ adapter: 'x', installed: 'x', beatEverySeconds: 1, runsDir });
});

describe('digest routes', () => {
  it('serves a real night as page and JSON', async () => {
    const page = await app.request('/digest/2026-01-01');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('alpha/job');
    const json = await app.request('/api/digest/2026-01-01');
    expect(json.status).toBe(200);
    const body = await json.json();
    expect(body.night).toBe('2026-01-01');
    expect(body.badLines).toBe(0);
    expect(body.rows).toHaveLength(3);
  });

  it('404s a night with no file', async () => {
    expect((await app.request('/digest/2026-02-02')).status).toBe(404);
    expect((await app.request('/api/digest/2026-02-02')).status).toBe(404);
  });

  it('404s a malformed night', async () => {
    expect((await app.request('/digest/tonight')).status).toBe(404);
    expect((await app.request('/api/digest/tonight')).status).toBe(404);
  });

  it('handles the empty night', async () => {
    const page = await app.request('/digest/2026-01-02');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const json = await app.request('/api/digest/2026-01-02');
    expect(json.status).toBe(200);
    expect((await json.json()).rows).toEqual([]);
  });

  it('reports a bad line and keeps the other rows', async () => {
    const page = await app.request('/digest/2026-01-03');
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toMatch(/1\s+line\s+could not be parsed/);
    expect(html).toContain('alpha/job');
    expect(html).toContain('beta/job');
    const body = await (await app.request('/api/digest/2026-01-03')).json();
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['alpha/job', 'beta/job']);
  });

  it('lists the same jobs in the same order on page and JSON', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    const body = await (await app.request('/api/digest/2026-01-01')).json();
    const jobs: string[] = body.rows.map((r: { job: string }) => r.job);
    const pageJobs = [...html.matchAll(/(?:alpha|mid|zeta)\/job/g)].map((m) => m[0]);
    expect(pageJobs).toEqual(jobs);
    expect(jobs).toEqual(['alpha/job', 'mid/job', 'zeta/job']);
  });
});
