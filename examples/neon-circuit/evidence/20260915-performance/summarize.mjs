import fs from 'node:fs';
import path from 'node:path';
const [beforePath, afterPath, output] = process.argv.slice(2);
function read(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse).filter(row => row.event === 'performance');
}
function summary(rows) {
  const samples = rows.filter(row => row.detail.frames >= 240 && row.detail.frames <= 4800).map(row => row.detail);
  const count = samples.reduce((s, x) => s + x.interval.samples, 0);
  const intervalMs = samples.reduce((s, x) => s + x.interval.meanMs * x.interval.samples, 0) / count;
  const avg = field => samples.reduce((s, x) => s + field(x), 0) / samples.length;
  return {
    cohort: 'report windows ending at frames 240 through 4800, excluding startup/capture',
    sampledIntervals: count, meanFrameIntervalMs: intervalMs, equivalentFps: 1000 / intervalMs,
    meanCpuCallbackIncludingPresentMs: avg(x => x.cpu.meanMs),
    meanSampledDraws: avg(x => x.engine.frame.counters.draws),
    meanSampledPipelineSwitches: avg(x => x.engine.frame.counters.pipelineSwitches),
    meanSampledUploadCalls: avg(x => x.engine.frame.counters.bufferUploads),
    meanSampledUploadBytes: avg(x => x.engine.frame.counters.bufferUploadBytes),
    checkpoints: rows.filter(row => [120, 1200, 2400, 3600, 4800, 6000, 7200].includes(row.detail.frames)).map(row => ({
      frames: row.detail.frames, intervalMs: row.detail.interval.meanMs,
      buffers: row.detail.engine.gpuResources.byType.buffer.current,
      frameCreatedBuffers: row.detail.engine.gpuResources.byType.buffer.frameCreated,
      thermalState: row.detail.thermalState,
    })),
    last: { frames: rows.at(-1).detail.frames, buffers: rows.at(-1).detail.engine.gpuResources.byType.buffer.current, thermalState: rows.at(-1).detail.thermalState },
  };
}
fs.mkdirSync(output, { recursive: true });
const before = read(beforePath), after = read(afterPath);
for (const [name, rows] of [['before', before], ['after', after]]) fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify(rows, null, 2) + '\n');
const result = { device: 'iPhone 15 Plus / A16', scenario: 'mobius-ring, hard AI duel, stationary player, 1864x860, 4x MSAA, reverse Z, diagnostics enabled in both runs',
  limitations: ['CPU callback timing includes present and waiting; it is not pure CPU busy time or GPU execution time.', 'GPU resource estimates are not process RSS.', 'thermalState is an iOS pressure category, not temperature or power measurement.', 'Frame counter cohort preserves similar fixed-camera workload; absolute elapsed time differs with frame rate.'],
  before: summary(before), after: summary(after),
};
fs.writeFileSync(path.join(output, 'comparison.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
