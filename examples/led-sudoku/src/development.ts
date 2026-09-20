import { Application, isAndroid } from '@nativescript/core';
/** Only development binaries accept opt-in diagnostic launch flags. */
export function isDevelopmentBuild(): boolean {
  if (isAndroid) return !!(Application.android.context.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE);
  return NSBundle.mainBundle.objectForInfoDictionaryKey('HYBuildConfiguration') === 'Debug';
}
