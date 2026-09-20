import { Application, isAndroid } from '@nativescript/core';
/** Intent/environment flags must never bypass purchases in a release binary. */
export function isDevelopmentBuild(): boolean {
  if (isAndroid) return (Application.android.context.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) !== 0;
  return NSBundle.mainBundle.objectForInfoDictionaryKey('HYBuildConfiguration') === 'Debug';
}
