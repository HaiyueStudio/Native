/** Capability describes the adapter, not permissions, product configuration or hardware access. */
export interface NativeCapabilities {
  platform: 'ios' | 'android';
  device: 'iphone' | 'ipad' | 'ios-on-mac' | 'android';
  desktop: boolean;
  camera: boolean;
  purchases: boolean;
  rewardedAds: 'available' | 'unverified';
}
export function capabilityPolicy(platform: 'ios'|'android', mac: boolean, tablet: boolean, camera: boolean): NativeCapabilities {
  return {platform,device:platform==='android'?'android':mac?'ios-on-mac':tablet?'ipad':'iphone',
    desktop:platform==='ios'&&mac,camera,purchases:true,rewardedAds:platform==='ios'&&mac?'unverified':'available'};
}
