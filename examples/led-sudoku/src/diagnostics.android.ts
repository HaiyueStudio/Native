import type { Page } from '@nativescript/core';
export function captureDiagnostics(_page: Page, filename = 'led-sudoku-screen.png'): unknown { return { method:'adb screencap' }; }
