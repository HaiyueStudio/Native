import { syncGameAssets } from './sync-game-assets.mjs';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { patchCanvas } from './patch-canvas.mjs';
const app=fileURLToPath(new URL('..',import.meta.url));
const tools=path.resolve(app,'../../.android-tools');
const localJdk=path.join(tools,'jdk');
const jdk=process.env.JAVA_HOME || (existsSync(localJdk) ? path.join(localJdk,readdirSync(localJdk).find(n=>n.startsWith('jdk-'))??'','Contents/Home') : '');
const sdk=process.env.ANDROID_HOME || path.join(tools,'sdk');
if(!existsSync(path.join(jdk,'bin/java'))||!existsSync(path.join(sdk,'platform-tools/adb')))throw new Error('Install JDK 21 and Android SDK, or set JAVA_HOME and ANDROID_HOME. See README-ANDROID.md.');
const args=process.argv.slice(2);const profile=path.join(app,'.ns-profile');mkdirSync(profile,{recursive:true});
if(['build','prepare','run'].includes(args[0])){ syncGameAssets(); console.log('Canvas binding patch:',patchCanvas()); }
const env={...process.env,JAVA_HOME:jdk,ANDROID_HOME:sdk,ANDROID_SDK_ROOT:sdk,ANDROID_USER_HOME:process.env.ANDROID_USER_HOME||path.join(tools,'user'),GRADLE_USER_HOME:process.env.GRADLE_USER_HOME||path.join(tools,'gradle'),PATH:[path.join(jdk,'bin'),path.join(sdk,'platform-tools'),path.join(sdk,'cmdline-tools/latest/bin'),process.env.PATH].join(path.delimiter)};
if(['build','prepare','run'].includes(args[0])) {
  for(const file of ['platforms/android-36/android.jar','build-tools/36.0.0/aapt2','build-tools/36.0.0/apksigner']) {
    if(!existsSync(path.join(sdk,file)))throw new Error(`Missing Android build dependency: ${file}`);
  }
  // NativeScript's doctor also requires an emulator binary. Physical-device builds
  // use the real SDK/Java tools validated above and do not need an emulator install.
  env.NS_SKIP_ENV_CHECK='1';
}
const result=spawnSync(process.execPath,[path.join(app,'node_modules/nativescript/bin/tns'),...args,'--profileDir',profile,'--disableAnalytics'],{cwd:app,env,stdio:'inherit'});
if(result.error)throw result.error;process.exit(result.status??1);
