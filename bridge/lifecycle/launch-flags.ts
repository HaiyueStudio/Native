import { Application, isAndroid } from '@nativescript/core';
/** Explicit development launch flags; no persistent change to production saves. */
export function nativeLaunchFlag(name: string): boolean {
  if (isAndroid) return (Application.android.foregroundActivity ?? Application.android.startActivity)?.getIntent()?.getBooleanExtra(name, false) ?? false;
  return String(NSProcessInfo.processInfo.environment.objectForKey(name)) === '1';
}
