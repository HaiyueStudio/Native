import {capabilityPolicy} from './capabilities';
export function getNativeCapabilities() {
  return capabilityPolicy('ios',NSProcessInfo.processInfo.iOSAppOnMac,UIDevice.currentDevice.userInterfaceIdiom===UIUserInterfaceIdiom.Pad,
    AVCaptureDevice.defaultDeviceWithMediaType(AVMediaTypeVideo)!=null);
}
