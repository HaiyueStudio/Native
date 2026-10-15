import { createGameCenterQueueClient } from './queue-client';
declare const HYGameCenterBridge: { new(): { start(bundleId: string): void; session(): string; request(json: string): boolean; poll(): string; stop(): void } };
/** Include native/HYGameCenter.swift using the build helper. Call on the app UI thread. */
export function createNativeGameCenterClient() {
  return createGameCenterQueueClient(new HYGameCenterBridge());
}
