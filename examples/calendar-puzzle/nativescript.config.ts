import { NativeScriptConfig } from '@nativescript/core';
export default {
  id: 'org.haiyue.native.calendarpuzzle',
  appPath: 'src',
  hooks: [{ type: 'before-checkForChanges', script: './scripts/validate-rewards.cjs' }],
  appResourcesPath: 'App_Resources',
  ios: { discardUncaughtJsExceptions: false,
    NativeSource: [{ name: 'HaiyueRewards', path: '../../bridge/rewards/native/ios/*.swift' }],
    SPMPackages: [{ name: 'GoogleMobileAds', libs: ['GoogleMobileAds'], repositoryURL: 'https://github.com/googleads/swift-package-manager-google-mobile-ads.git', version: '13.10.0' }],
  },
  android: { id: 'org.haiyue.games.calendarpuzzle' },
} as NativeScriptConfig;
