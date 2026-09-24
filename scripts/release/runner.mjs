import { spawnSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';

/** Child errors/signals/nonzero exits must never turn a release gate green. */
export function runLogged(command, args, { cwd, env = process.env, log }) {
  const fd = openSync(log, 'w');
  try {
    const result = spawnSync(command, args, { cwd, env, stdio: ['ignore', fd, fd] });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} exited ${result.status ?? result.signal}; see ${log}`);
  } finally { closeSync(fd); }
}
export async function runStages(stages, report, onResult = () => {}) {
  for (const { name, run } of stages) {
    const start = Date.now();
    const result = { name, status: 'passed' };
    try { await run(); }
    catch (error) { result.status = 'failed'; result.error = error.message; }
    result.durationMs = Date.now() - start;
    report.stages.push(result);
    onResult(result);
    if (result.status === 'failed') {
      for (const pending of stages.slice(report.stages.length)) report.stages.push({ name: pending.name, status: 'skipped', reason: `Blocked by ${name}` });
      report.status = 'failed';
      return false;
    }
  }
  report.status = 'passed';
  return true;
}
