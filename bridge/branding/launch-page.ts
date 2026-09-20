import { Color, GridLayout, Page } from '@nativescript/core';
import { NativeEngineSplash, type NativeEngineSplashOptions } from './engine-splash';

/** Reusable native launch page. Add app UI to gameRoot while the brand overlay
 * covers initialization; call splash.presented() only when the app is visible.
 * The app owns lifetime/disposal so backgrounding and modals do not replay it. */
export class NativeEngineLaunchPage extends Page {
  readonly gameRoot = new GridLayout();
  readonly splash: NativeEngineSplash;

  constructor(options: NativeEngineSplashOptions = {}) {
    super();
    this.actionBarHidden = true;
    this.backgroundColor = new Color('#07111f');
    const layers = new GridLayout();
    layers.iosOverflowSafeArea = true;
    // App controls respect notches/home indicators; the branding fills the screen.
    this.gameRoot.iosOverflowSafeArea = false;
    layers.addChild(this.gameRoot);
    this.splash = new NativeEngineSplash(layers, options);
    this.content = layers;
  }
}
