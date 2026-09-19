import { NativeScriptConfig } from '@nativescript/core';
export default {
  id: 'org.haiyue.native.calendarpuzzle',
  appPath: 'src',
  appResourcesPath: 'App_Resources',
  ios: { discardUncaughtJsExceptions: false },
  android: { id: 'org.haiyue.games.calendarpuzzle' },
} as NativeScriptConfig;
