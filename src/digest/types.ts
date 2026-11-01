export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log (plan.md § 1).
export type DigestRow = {
  job: string;
  // `null` when the log line has no owner. Views render it as `—`.
  owner: string | null;
  // Number of log lines for this job.
  runs: number;
  // Number of log lines for this job with status `retry`.
  retries: number;
  // Status of the job's last log line (by file order).
  lastStatus: RunStatus;
  // `error` of the job's last line that has one; `null` if none of its lines has one.
  lastError: string | null;
  // `at` of the first and last line, as written in the log (offset kept, never converted to UTC).
  firstAt: string;
  lastAt: string;
};

export type Night = {
  // `YYYY-MM-DD`, as in `runs/<night>.jsonl`.
  night: string;
  // One row per job, sorted by job.
  rows: DigestRow[];
  // Lines that did not parse. Counted, never thrown.
  badLines: number;
};

// Reads `<runsDir>/<night>.jsonl`. Returns `null` when the file does not exist (the page answers
// 404). An empty file returns `{ night, rows: [], badLines: 0 }`.
// Implemented in `src/digest/read.ts` as `export const readNight: ReadNight`.
export type ReadNight = (runsDir: string, night: string) => Night | null;
