import type { Generated, Options } from '../../../../Games/games/led-sudoku/rules';
export interface GeneratorWorker { postMessage(data: unknown): void; terminate(): void; onmessage: (e: { data: { id: number; result?: Generated; error?: string } }) => void; onerror: (e: unknown) => void; }
/** Persistent CommonJS worker avoids repeated Android V8/ESM worker startup. */
export class NativeGenerator {
  private worker: GeneratorWorker | null = null;
  private serial = 0;
  private cancel: (() => void) | null = null;
  private readonly create: () => GeneratorWorker;
  constructor(create: () => GeneratorWorker) { this.create = create; }
  generate(options: Options, seed: number): Promise<Generated | null> {
    this.cancel?.(); const id = ++this.serial;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (result: Generated | null, error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); this.cancel = null; error ? reject(error) : resolve(result); };
      const timer = setTimeout(() => { this.worker?.terminate(); this.worker = null; finish(null, new Error('出题超时，请重试。')); }, 30000);
      this.cancel = () => finish(null);
      try {
        this.worker ??= this.create();
        this.worker.onmessage = ({ data }) => { if (id === this.serial && data.id === id) finish(data.result ?? null, data.error ? new Error(data.error) : undefined); };
        this.worker.onerror = () => { this.worker?.terminate(); this.worker = null; finish(null, new Error('出题线程异常，请重新开始。')); };
        this.worker.postMessage({ id, options, seed });
      } catch (error) { finish(null, error instanceof Error ? error : new Error(String(error))); }
    });
  }
  dispose(): void { this.serial++; this.cancel?.(); this.worker?.terminate(); this.worker = null; }
}
