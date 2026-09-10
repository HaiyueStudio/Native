/** 'any' permits portrait and both landscape directions; upside-down is excluded. */
export type OrientationPolicy = 'portrait' | 'landscape' | 'any';
export const orientationMasks = Object.freeze({ portrait: 2, landscape: 24, any: 26 });
export function orientationMask(policy: OrientationPolicy): number {
  const mask = orientationMasks[policy];
  if (!mask) throw new Error(`Unknown screen orientation policy: ${policy}`);
  return mask;
}
export function orientationPlistValues(policy: OrientationPolicy): string[] {
  orientationMask(policy);
  return policy === 'portrait' ? ['UIInterfaceOrientationPortrait'] : policy === 'landscape'
    ? ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight']
    : ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'];
}
export function assertOrientationSupported(policy: OrientationPolicy, supported: OrientationPolicy): void {
  const requested = orientationMask(policy), available = orientationMask(supported);
  if ((requested & available) !== requested) throw new Error(`Orientation ${policy} exceeds this App's supported ${supported} policy. Update the build configuration first.`);
}
