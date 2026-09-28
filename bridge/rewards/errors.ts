/** Safe, serializable diagnostics. No SDK messages, identifiers or response payloads. */
export type RewardFailureStage = 'configuration' | 'consent_update' | 'consent_load' | 'consent_present' | 'privacy_present' | 'sdk_initialize' | 'ad_load' | 'ad_present' | 'lifecycle' | 'unknown';
export type RewardFailureCode = 'sdk_error' | 'no_fill' | 'network' | 'timeout' | 'consent_unavailable' | 'invalid_unit' | 'policy_rejected' | 'disposed' | 'busy' | 'no_presenter' | 'inactive' | 'presentation_rejected' | 'invalid_action' | 'bridge_error' | 'unknown';
export interface RewardSDKError { readonly domain: string; readonly code: number; }
export interface RewardFailure {
  readonly version: 1;
  readonly platform: 'ios' | 'android';
  readonly action: string;
  readonly stage: RewardFailureStage;
  readonly code: RewardFailureCode;
  readonly phase: 'offline' | 'unavailable' | 'error';
  readonly sdk?: RewardSDKError;
  readonly underlying?: RewardSDKError;
  readonly timestamp: string;
  readonly elapsedMs: number;
}
export class RewardError extends Error {
  constructor(readonly failure: RewardFailure) {
    // Existing consumers use error.message to select localized UI.
    super(failure.phase); this.name = 'RewardError';
  }
}
const stages: readonly string[] = ['configuration', 'consent_update', 'consent_load', 'consent_present', 'privacy_present', 'sdk_initialize', 'ad_load', 'ad_present', 'lifecycle', 'unknown'];
const codes: readonly string[] = ['sdk_error', 'no_fill', 'network', 'timeout', 'consent_unavailable', 'invalid_unit', 'policy_rejected', 'disposed', 'busy', 'no_presenter', 'inactive', 'presentation_rejected', 'invalid_action', 'bridge_error', 'unknown'];
function sdkError(value: any): RewardSDKError | undefined {
  if (!value || typeof value.domain !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(value.domain) || !Number.isSafeInteger(value.code)) return undefined;
  return Object.freeze({ domain: value.domain, code: value.code });
}
/** Also accepts legacy error:phase events and safely ignores malformed/extra fields. */
export function rewardErrorFromEvent(event: string, platform: RewardFailure['platform'], action: string, startedAt: number): RewardError {
  const match = /^error:(offline|unavailable|error)(?::(.*))?$/.exec(event);
  let details: any;
  try { details = match?.[2] && match[2].length <= 4096 ? JSON.parse(match[2]) : undefined; } catch { /* Legacy/malformed event. */ }
  const sdk = sdkError(details?.sdk), underlying = sdkError(details?.underlying);
  const phase = (match?.[1] ?? 'unavailable') as RewardFailure['phase'];
  return new RewardError(Object.freeze({
    version: 1, platform, action,
    stage: stages.includes(details?.stage) ? details.stage : 'unknown',
    code: codes.includes(details?.code) ? details.code : phase === 'offline' ? 'network' : 'unknown',
    phase, ...(sdk ? { sdk } : {}), ...(underlying ? { underlying } : {}),
    timestamp: new Date().toISOString(), elapsedMs: Math.max(0, Date.now() - startedAt),
  }));
}
