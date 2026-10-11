import {Application} from '@nativescript/core';
import {capabilityPolicy} from './capabilities';
export function getNativeCapabilities() {
  return capabilityPolicy('android',false,false,Application.android.context.getPackageManager().hasSystemFeature('android.hardware.camera.any'));
}
