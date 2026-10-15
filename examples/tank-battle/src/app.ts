import clone from 'core-js-pure/actual/structured-clone';
import { Application } from '@nativescript/core';
import { installNativeSaveRuntime } from '../../../bridge/storage/clone-runtime';
import { createLaunchPage } from './main-page';
installNativeSaveRuntime(clone);
Application.run({ create: createLaunchPage });
