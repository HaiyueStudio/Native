import { StoreFailure } from './controller';
/** Settle outstanding JS promises on disposal even when a native callback is suppressed.
 * Checkout has no JS deadline: never unlock a second checkout while system UI is active. */
export class StoreRequests {
  private closed = false;
  private readonly pending = new Set<(reason: StoreFailure) => void>();
  call(action: string, dispatch: (complete: (json: string) => void) => void): Promise<Record<string, unknown>> {
    if (this.closed) return Promise.reject(new StoreFailure('unavailable'));
    return new Promise((resolve, reject) => {
      let ended = false;
      const fail = (reason: StoreFailure) => { if (!ended) { ended = true; this.pending.delete(fail); reject(reason); } };
      this.pending.add(fail);
      try {
        dispatch(json => {
          if (ended) return;
          try {
            const value = JSON.parse(json);
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StoreFailure('error');
            if (value.error) {
              if (value.error === 'cancelled' && action === 'purchase') value.result = 'cancelled';
              else throw new StoreFailure(['offline', 'unavailable', 'cancelled'].includes(value.error) ? value.error : 'error');
            }
            ended = true; this.pending.delete(fail); resolve(value);
          } catch (error) { fail(error instanceof StoreFailure ? error : new StoreFailure('error')); }
        });
      } catch { fail(new StoreFailure('error')); }
    });
  }
  dispose(): void {
    this.closed = true;
    for (const reject of [...this.pending]) reject(new StoreFailure('unavailable'));
  }
}
