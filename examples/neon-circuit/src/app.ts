import clone from 'core-js-pure/actual/structured-clone';
import NativeURL from 'core-js-pure/actual/url';
import { installNativeSaveRuntime } from '../../../bridge/storage/clone-runtime';
import { Application } from '@nativescript/core';
import { NativeOrientationController } from '../../../bridge/display/orientation.ios';
import type { OrientationPolicy } from '../../../bridge/display/orientation-policy';
import policy from '../orientation.json';
export const orientation = new NativeOrientationController(policy.supported as OrientationPolicy, policy.initial as OrientationPolicy);
installNativeSaveRuntime(clone);
// glTF resolves bundled image identities using standard URLs; no requests leave the device.
if (typeof globalThis.URL === 'undefined') Object.defineProperty(globalThis, 'URL', { configurable: true, value: NativeURL });
Application.run({ moduleName: 'main-page' });
