// NativeScript resolves platform.ios.ts / platform.android.ts. This file supplies the common type surface.
import type { View, ImageSource } from '@nativescript/core';
import type { HYNativeTextHandle, HYTextObservation } from './types';
export function assertMainThread(): void { throw new Error('Native UI requires iOS or Android NativeScript'); }
export function observeText(_view: View, _changed: (state: HYTextObservation) => void, _dismissLabel?: string): HYNativeTextHandle { throw new Error('Native UI requires a platform text service'); }
export function observeKeyboard(_view: View, _changed: (height: number) => void): () => void { return () => {}; }
export function setClipping(_view: View, _clip: boolean): void {}
export function focusNative(view: View): void { view.focus(); }
export function systemIcon(_name: string): ImageSource | undefined { return undefined; }
export function isAccessibilityInteraction(): boolean { return false; }

/** Keep the presenting page visible beneath the portable dialog backdrop. */
export function modalPresentationOptions(): Partial<import('@nativescript/core').ShowModalOptions> { return {}; }
