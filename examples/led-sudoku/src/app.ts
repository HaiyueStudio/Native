import { readPreferences } from './preferences';
import { t } from '../../../../Games/games/led-sudoku/i18n';
import clone from 'core-js-pure/actual/structured-clone';
import { Application } from '@nativescript/core';
import { installNativeSaveRuntime } from '../../../bridge/storage/clone-runtime';
import { NativeOrientationController } from '../../../bridge/display/orientation';
import { NativeEngineLaunchPage } from '../../../bridge/branding/launch-page';
import { onLoaded, onUnloaded } from './engine-page';
export const orientation = new NativeOrientationController('portrait', 'portrait');
installNativeSaveRuntime(clone);
Application.run({ create: () => {
  const page = new NativeEngineLaunchPage({ orientation: 'portrait', message:t(readPreferences().language,'loading') });
  page.gameRoot.id = 'appRoot';
  page.on('loaded', onLoaded);
  page.on('unloaded', onUnloaded);
  return page;
} });
