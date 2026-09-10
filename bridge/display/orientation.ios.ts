import { Application } from '@nativescript/core';
import { assertOrientationSupported, orientationMask, type OrientationPolicy } from './orientation-policy';

let active: NativeOrientationController | null = null;
/** Install before Application.run; plist support must include every runtime policy. */
export class NativeOrientationController {
  private policy: OrientationPolicy;
  private disposed = false;
  constructor(readonly supported: OrientationPolicy, initial: OrientationPolicy = supported, private readonly report: (event: string, detail: unknown) => void = () => {}) {
    if (active) throw new Error('Only one App orientation controller may be active.');
    assertOrientationSupported(initial, supported);
    this.policy = initial;
    active = this;
    const Parent = (Application.ios.delegate ?? NSObject) as unknown as typeof NSObject;
    @NativeClass()
    class OrientationDelegate extends Parent implements UIApplicationDelegate {
      static ObjCProtocols = [UIApplicationDelegate];
      applicationSupportedInterfaceOrientationsForWindow(_application: UIApplication, _window: UIWindow): UIInterfaceOrientationMask {
        return orientationMask(active?.policy ?? supported);
      }
    }
    Application.ios.delegate = OrientationDelegate;
    Application.on(Application.resumeEvent, this.apply);
    Application.on(Application.displayedEvent, this.apply);
  }
  setPolicy(policy: OrientationPolicy): void {
    if (this.disposed) throw new Error('Orientation controller is disposed.');
    assertOrientationSupported(policy, this.supported);
    this.policy = policy;
    this.apply();
  }
  snapshot() { return { supported: this.supported, policy: this.policy, mask: orientationMask(this.policy) }; }
  readonly apply = (): void => {
    if (this.disposed) return;
    const window = Application.ios.window;
    const scene = window?.windowScene;
    const controller = window?.rootViewController;
    this.report('orientation-policy', this.snapshot());
    if (!controller) return;
    if (typeof controller.setNeedsUpdateOfSupportedInterfaceOrientations === 'function') {
      controller.setNeedsUpdateOfSupportedInterfaceOrientations();
      if (scene && typeof scene.requestGeometryUpdateWithPreferencesErrorHandler === 'function') {
        const preferences = UIWindowSceneGeometryPreferencesIOS.alloc().initWithInterfaceOrientations(orientationMask(this.policy));
        scene.requestGeometryUpdateWithPreferencesErrorHandler(preferences, error => this.report('orientation-error', { message: error.localizedDescription }));
      }
    } else {
      UIViewController.attemptRotationToDeviceOrientation();
    }
  };
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    Application.off(Application.resumeEvent, this.apply);
    Application.off(Application.displayedEvent, this.apply);
    if (active === this) active = null;
  }
}
