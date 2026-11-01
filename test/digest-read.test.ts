import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('has 5 jobs sorted and 1 bad line', () => {
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('aggregates fixtures/refresh', () => {
    expect(night?.rows.find((r) => r.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps null owner and failed status', () => {
    expect(night?.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
    const backup = night?.rows.find((r) => r.job === 'notes/backup');
    expect(backup?.lastStatus).toBe('fail');
    expect(backup?.lastError).toBe('quota exceeded');
  });
});

describe('readNight on temp dirs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-'));

  it('returns null for a missing file', () => {
    expect(readNight(dir, '2000-01-01')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    writeFileSync(join(dir, '2000-01-02.jsonl'), '');
    expect(readNight(dir, '2000-01-02')).toEqual({ night: '2000-01-02', rows: [], badLines: 0 });
  });

  it('handles null/missing owner, blank lines and bad shapes', () => {
    const lines = [
      '{"at":"2000-01-03T01:00:00+02:00","job":"a","status":"ok","owner":null}',
      '',
      '{"at":"2000-01-03T02:00:00+02:00","job":"b","status":"ok"}',
      '{"at":"x","job":"c","status":"weird"}',
      '{"job":"c","status":"ok"}',
      '[1]',
      'null',
    ];
    writeFileSync(join(dir, '2000-01-03.jsonl'), lines.join('\n') + '\n');
    const n = readNight(dir, '2000-01-03');
    expect(n?.badLines).toBe(4);
    expect(n?.rows.map((r) => [r.job, r.owner])).toEqual([
      ['a', null],
      ['b', null],
    ]);
  });
});
