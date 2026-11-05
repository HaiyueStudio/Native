import {Application} from '@nativescript/core';
import clone from 'core-js-pure/actual/structured-clone';
import {installNativeAbortRuntime} from '../../../bridge/lifecycle/abort-runtime';
import {installNativeSaveRuntime} from '../../../bridge/storage/clone-runtime';
// The scene allocates its cancellation owner before NativeRenderHost is created.
installNativeAbortRuntime();
installNativeSaveRuntime(clone);
Application.run({moduleName:'main-page'});
