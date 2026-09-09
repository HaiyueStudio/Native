export interface NativeFrameDriver {
  request(callback: (time: number) => void): number;
  cancel(handle: number): void;
  now(): number;
}

/** Adapts native handle 0 and native timestamps to Engine's frame contract. */
export function createFrameScheduler(driver: NativeFrameDriver, onError: (error: unknown) => void) {
  let next = 1;
  const pending = new Map<number, number>();
  return {
    request(callback: (time: number) => void): number {
      const id = next++;
      const nativeId = driver.request(() => {
        if (!pending.delete(id)) return;
        try { callback(driver.now()); } catch (error) { onError(error); }
      });
      pending.set(id, nativeId);
      return id;
    },
    cancel(id: number): void {
      const nativeId = pending.get(id);
      if (nativeId === undefined) return;
      pending.delete(id);
      driver.cancel(nativeId);
    },
    cancelAll(): void {
      for (const id of pending.values()) driver.cancel(id);
      pending.clear();
    },
    get pendingCount(): number { return pending.size; },
  };
}
