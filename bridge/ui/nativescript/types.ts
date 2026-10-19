import type { ImageSource, LayoutBase, View } from '@nativescript/core';
import type { HYPlatformView, HYResource, HYTheme } from '@haiyue/ui/core';

export type HYNativePlatformViewFactory = (host: LayoutBase, context: Readonly<{key: string; slot: string}>) => HYPlatformView;
export interface HYNativeEnvironment {
  /** Omit to use the operating system's Dynamic Type / font scale. */
  readonly fontScale?: number;
  readonly theme?: HYTheme;
}
export interface HYNativeScriptOptions {
  /** Localized title for the iOS keyboard dismiss button. Defaults to "Done". */
  readonly keyboardDismissLabel?: string;
  readonly environment?: HYNativeEnvironment;
  readonly resolveResource?: (resource: HYResource, context: Readonly<{key: string; kind: 'Image'|'Icon'}>) => string | ImageSource;
  readonly platformViews?: Readonly<Record<string, HYNativePlatformViewFactory>>;
  /** Single owner of Android back. Typically () => page.back(). Return true when consumed. */
  readonly onBack?: () => boolean;
  readonly onEnvironment?: (value: Readonly<{width: number; height: number; scale: number; keyboardHeight: number}>) => void;
  readonly onError?: (error: Error) => void;
  /** NativeScript Page owns safe area. Choose host only when an enclosing host already owns it. */
  readonly safeArea?: 'system' | 'host';
}
export interface HYNativeDiagnostics {
  readonly commits: number; readonly created: number; readonly updated: number; readonly moved: number; readonly removed: number;
  readonly activeNodes: number; readonly activeListeners: number; readonly activeResources: number; readonly activeTimers: number;
}
/** Internal platform boundary; native handles never cross the shared component protocol. */
export interface HYTextObservation { readonly value: string; readonly composing: boolean; }
export interface HYNativeTextHandle {
  read(): HYTextObservation;
  write(value: string): void;
  dispose(): void;
}
export interface HYNativePlatform {
  assertMainThread(): void;
  observeText(view: View, changed: (value: HYTextObservation) => void, dismissLabel?: string): HYNativeTextHandle;
}
