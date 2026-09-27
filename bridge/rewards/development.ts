import { Application, isAndroid } from '@nativescript/core';
/** Derived only from the signed/native build, never an intent, environment flag or UI toggle. */
export function isNativeDebugBuild(): boolean {
  try {
    if (isAndroid) return (Application.android.context.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) !== 0;
    return NSBundle.mainBundle.objectForInfoDictionaryKey('HYBuildConfiguration') === 'Debug';
  } catch { return false; }
}
