import { NativeScriptConfig } from '@nativescript/core';
import * as achievements from './achievements.json';
export default {
  id: 'org.haiyue.native.rubikscube',
  appPath: 'src',
  appResourcesPath: 'App_Resources',
  ios: { discardUncaughtJsExceptions: false, ...(achievements.provider === 'game-center' ? {
    NativeSource: [{ name: 'HaiyueGameCenter', path: '../../bridge/achievements/game-center/native/*.swift' }],
  } : {}) },
  android: { id: 'org.haiyue.games.rubikscube' },
} as NativeScriptConfig;
