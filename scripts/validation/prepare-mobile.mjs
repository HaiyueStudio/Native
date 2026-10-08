// Isolated test host, never installs over a consuming game or writes its saves.
import {cpSync,existsSync,lstatSync,unlinkSync,mkdirSync,readFileSync,readdirSync,symlinkSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const modules=path.resolve(process.argv[2]??'');if(!existsSync(path.join(modules,'nativescript')))throw Error('Pass a NativeScript host node_modules directory');
const host=path.join(root,'artifacts/native-validation');mkdirSync(path.join(host,'node_modules'),{recursive:true});
const link=(a,b)=>{if(!existsSync(b))symlinkSync(a,b,'dir');};
for(const n of readdirSync(modules)){if(n==='@haiyue'||n==='.bin')continue;link(path.join(modules,n),path.join(host,'node_modules',n));}
mkdirSync(path.join(host,'node_modules/@haiyue'),{recursive:true});const nativePackage=path.join(host,'node_modules/@haiyue/native');if(existsSync(nativePackage)&&lstatSync(nativePackage).isSymbolicLink())unlinkSync(nativePackage);cpSync(path.join(root,'artifacts/native-development-package'),nativePackage,{recursive:true});
cpSync(path.join(root,'scripts/validation/mobile/src'),path.join(host,'src'),{recursive:true});
const write=(f,s)=>{mkdirSync(path.dirname(path.join(host,f)),{recursive:true});writeFileSync(path.join(host,f),s);};
write('package.json',JSON.stringify({name:'native-validation',version:'0.1.3',private:true,main:'src/app.ts',dependencies:{'@nativescript/core':'9.1.1','@haiyue/native':'file:../native-development-package'},devDependencies:{'@nativescript/ios':'9.0.3','@nativescript/android':'9.0.3','@nativescript/webpack':'5.0.38',nativescript:'9.1.1',typescript:'5.7.3'}},null,2));
write('nativescript.config.ts',`const {monetizationBuild}=require(process.cwd()+'/node_modules/@haiyue/native/bridge/monetization/build.cjs');const build=monetizationBuild({development:true,rewards:{iosAppId:'ca-app-pub-3940256099942544~1458002511',androidAppId:'ca-app-pub-3940256099942544~3347511713'}});export default {id:'org.haiyue.nativevalidation',appPath:'src',appResourcesPath:'App_Resources',ios:{...build.ios,discardUncaughtJsExceptions:false}};`);
write('webpack.config.js',`const webpack=require('@nativescript/webpack');module.exports=env=>{if(env.android)env.commonjs=true;webpack.init(env);return webpack.resolveConfig();};`);
write('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2020',module:'esnext',experimentalDecorators:true,noEmitHelpers:true,skipLibCheck:true,moduleResolution:'bundler',types:['@nativescript/types']},include:['src/**/*.ts']}));
write('App_Resources/iOS/build.xcconfig','IPHONEOS_DEPLOYMENT_TARGET = 15.0;\nTARGETED_DEVICE_FAMILY = 1,2;\nCODE_SIGN_STYLE = Automatic;\n');
write('App_Resources/iOS/Info.plist',`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string><key>CFBundleName</key><string>$(PRODUCT_NAME)</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleDisplayName</key><string>Native Validation</string><key>CFBundleShortVersionString</key><string>0.1.3</string><key>CFBundleVersion</key><string>1</string><key>NSCameraUsageDescription</key><string>Validate Native QR scanning.</string><key>GADApplicationIdentifier</key><string>ca-app-pub-3940256099942544~1458002511</string><key>HYBuildConfiguration</key><string>$(CONFIGURATION)</string><key>UILaunchScreen</key><dict/><key>UISupportedInterfaceOrientations</key><array><string>UIInterfaceOrientationPortrait</string><string>UIInterfaceOrientationLandscapeLeft</string><string>UIInterfaceOrientationLandscapeRight</string></array></dict></plist>`);
const {createRequire}=await import('node:module');const {monetizationBuild}=createRequire(import.meta.url)(path.join(root,'bridge/monetization/build.cjs'));
const build=monetizationBuild({development:true,rewards:{iosAppId:'ca-app-pub-3940256099942544~1458002511',androidAppId:'ca-app-pub-3940256099942544~3347511713'}});
write('App_Resources/Android/app.gradle',build.androidGradle+"\nandroid {defaultConfig { minSdkVersion 26 }}\ndependencies { implementation 'com.journeyapps:zxing-android-embedded:4.3.0' }\n");
write('App_Resources/Android/gradle.properties','compileSdk=36\ntargetSdk=36\nbuildToolsVersion=36.0.0\n');
write('App_Resources/Android/src/main/AndroidManifest.xml',`<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="__PACKAGE__"><uses-permission android:name="android.permission.CAMERA"/><uses-permission android:name="android.permission.INTERNET"/><application android:name="com.tns.NativeScriptApplication" android:label="Native Validation" android:theme="@style/AppTheme"><provider android:name="org.haiyue.share.HaiyueShareProvider" android:authorities="org.haiyue.nativevalidation.haiyue.share" android:exported="false" android:grantUriPermissions="true"><meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/haiyue_share_paths"/></provider><meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-3940256099942544~3347511713"/><activity android:name="com.tns.NativeScriptActivity" android:exported="true" android:configChanges="keyboardHidden|orientation|screenSize|smallestScreenSize|screenLayout|uiMode|density|locale|layoutDirection"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>`);
write('App_Resources/Android/src/main/res/values/styles.xml','<resources><style name="AppThemeBase" parent="Theme.AppCompat.NoActionBar"/><style name="AppTheme" parent="AppThemeBase"/><style name="NativeScriptToolbarStyleBase" parent="Widget.AppCompat.Toolbar"/><style name="NativeScriptToolbarStyle" parent="NativeScriptToolbarStyleBase"/></resources>');
console.log(host);

write('App_Resources/Android/src/main/res/xml/haiyue_share_paths.xml',readFileSync(path.join(root,'bridge/share/android/haiyue_share_paths.xml'),'utf8'));
write('App_Resources/Android/src/main/java/org/haiyue/share/HaiyueShareProvider.java',readFileSync(path.join(root,'bridge/share/android/HaiyueShareProvider.java'),'utf8'));

// Opt-in content-generation acceptance, using explicitly supplied local Engine builds.
const engineFlag = process.argv.indexOf('--share-content-engine');
if (engineFlag >= 0) {
  const engine = path.resolve(process.argv[engineFlag + 1] ?? '');
  const polyfills = path.join(root, 'artifacts/share-content-polyfills/node_modules/@formatjs');
  if (!existsSync(polyfills)) throw Error('Install the pinned share-mobile polyfills first; see scripts/validation/README.md');
  cpSync(polyfills, path.join(host, 'node_modules/@formatjs'), {recursive: true});
  for (const name of ['engine', 'extensions']) {
    const source = path.join(engine, name), destination = path.join(host, 'node_modules/@haiyue', name);
    if (!existsSync(path.join(source, 'dist/index.js'))) throw Error(`Build ${source} first`);
    mkdirSync(destination, { recursive: true });
    cpSync(path.join(source, 'dist'), path.join(destination, 'dist'), { recursive: true });
    cpSync(path.join(source, 'package.json'), path.join(destination, 'package.json'));
  }
  const pkg = JSON.parse(readFileSync(path.join(host, 'package.json')));
  Object.assign(pkg.dependencies, { '@formatjs/intl-getcanonicallocales': '3.2.12', '@nativescript/canvas': '2.1.18', 'core-js-pure': JSON.parse(readFileSync(path.join(modules,'core-js-pure/package.json'))).version,
    '@haiyue/engine': '0.2.1', '@haiyue/extensions': '0.2.1' });
  write('package.json', JSON.stringify(pkg, null, 2));
  const types = JSON.parse(readFileSync(path.join(host, 'tsconfig.json')));
  Object.assign(types.compilerOptions, {types: ['@nativescript/types', '@webgpu/types'], baseUrl: '.', paths: {'@haiyue/native/bridge/*':['node_modules/@haiyue/native/bridge/*']}});
  write('tsconfig.json', JSON.stringify(types, null, 2));
  cpSync(path.join(root, 'scripts/validation/share-mobile/app.ts'), path.join(host, 'src/app.ts'));
}
