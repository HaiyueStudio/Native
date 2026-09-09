/** Canvas mutates its input descriptor; never pass Engine's frozen values through. */
export function copyDeviceDescriptor(descriptor?: GPUDeviceDescriptor): GPUDeviceDescriptor & { requiredFeatures: GPUFeatureName[] } {
  return {
    ...descriptor,
    requiredFeatures: Array.from(descriptor?.requiredFeatures ?? []),
    ...(descriptor?.requiredLimits ? { requiredLimits: { ...descriptor.requiredLimits } } : {}),
  };
}
