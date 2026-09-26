import { Application, isAndroid } from '@nativescript/core';
if(isAndroid)Application.android.on(Application.android.activityResumedEvent,args=>{const window=args.activity.getWindow();window.addFlags(128);window.getDecorView().setSystemUiVisibility(1792);if(android.os.Build.VERSION.SDK_INT>=30)window.setDecorFitsSystemWindows(false);});
Application.run({moduleName:'main-page'});
