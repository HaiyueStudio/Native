// Optional Haiyue Engine adapter. Import system capabilities through their own subpaths.
export { NativeRenderHost, type NativeRenderHostOptions, type NativeHostInput } from './lifecycle/host';
export { NativeSurface, NativeSurfaceUnavailableError, type NativeCanvasInput } from './render/surface';
export { NativeTouchInput, type NativeTouchSample } from './input/native-touch';
export { NativeCanvasTextures } from './render/canvas-textures';
export { NativeDemandFrames } from './lifecycle/demand-frames';
export { PresentationPause } from './lifecycle/presentation-pause';
