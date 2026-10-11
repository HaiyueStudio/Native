import {Application,type View} from '@nativescript/core';
import {windowMetrics} from './window-metrics';
export type NativeWindowMetrics=ReturnType<typeof windowMetrics>;
/** Observe the supplied view, never the main screen's dimensions. Insets are informational: do not subtract them twice. */
export class NativeWindowObserver {
 private last='';private disposed=false;
 constructor(private view:View,private changed:(metrics:NativeWindowMetrics)=>void){view.on('layoutChanged',this.refresh);view.on('loaded',this.refresh);Application.on(Application.resumeEvent,this.refresh);this.refresh();}
 snapshot():NativeWindowMetrics{return windowMetrics(this.view);}
 readonly refresh=()=>{if(this.disposed)return;const m=this.snapshot(),key=JSON.stringify(m);if(m.width<=0||m.height<=0||key===this.last)return;this.last=key;this.changed(m);};
 dispose(){if(this.disposed)return;this.disposed=true;this.view.off('layoutChanged',this.refresh);this.view.off('loaded',this.refresh);Application.off(Application.resumeEvent,this.refresh);}
}
