import { Application, AndroidApplication, type EventData } from '@nativescript/core';
import { assertOrientationSupported, type OrientationPolicy } from './orientation-policy';
export class NativeOrientationController {
  private policy: OrientationPolicy;
  private disposed = false;
  constructor(readonly supported: OrientationPolicy, initial: OrientationPolicy = supported) {
    assertOrientationSupported(initial, supported); this.policy = initial;
    Application.android.on(AndroidApplication.activityCreatedEvent, this.apply);
    Application.on(Application.resumeEvent, this.apply); Application.on(Application.displayedEvent, this.apply);
  }
  setPolicy(policy: OrientationPolicy): void { assertOrientationSupported(policy,this.supported); this.policy=policy; this.apply(); }
  snapshot() { return {supported:this.supported,policy:this.policy}; }
  readonly apply = (args?: EventData): void => {
    if (this.disposed) return;
    const activity = (args as EventData & {activity?:android.app.Activity})?.activity ?? Application.android.foregroundActivity ?? Application.android.startActivity;
    if (!activity) return;
    const orientation = this.policy==='landscape' ? android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : this.policy==='portrait' ? android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT : android.content.pm.ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR;
    activity.setRequestedOrientation(orientation);
    const window=activity.getWindow();
    window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    window.getDecorView().setSystemUiVisibility(5894); // immersive sticky, fullscreen, hidden navigation, stable layout
    if (android.os.Build.VERSION.SDK_INT>=28) { const attributes=window.getAttributes(); attributes.layoutInDisplayCutoutMode=android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES; window.setAttributes(attributes); }
  };
  dispose(): void {if(this.disposed)return;this.disposed=true;Application.android.off(AndroidApplication.activityCreatedEvent,this.apply);Application.off(Application.resumeEvent,this.apply);Application.off(Application.displayedEvent,this.apply);}
}
