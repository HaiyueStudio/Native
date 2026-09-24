import { NativeScriptConfig } from '@nativescript/core';
export default {
  id: 'org.haiyue.native.neoncircuit',
  appPath: 'src',
  appResourcesPath: 'App_Resources',
  ios: { discardUncaughtJsExceptions: false },
  android: { id: 'org.haiyue.games.neoncircuit' },
} as NativeScriptConfig;
