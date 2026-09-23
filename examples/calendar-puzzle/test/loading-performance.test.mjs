import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(file, modules) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  runInNewContext(js, { exports, require: name => { assert.ok(modules[name], name); return modules[name]; }, console: { log() {}, error() {} } });
  return exports;
}
test('loading overlay waits for presentation and a failure during fade remains visible', async () => {
  let animations = 0, finish;
  class View {
    children = [];
    listeners = new Map();
    size = { width: 932, height: 430 };
    getActualSize() { return this.size; }
    on(event, handler) { this.listeners.set(event, handler); }
    off(event) { this.listeners.delete(event); }
    addChild(child) { this.children.push(child); }
    removeChild(child) { this.children = this.children.filter(c => c !== child); }
    animate() { animations++; const p = new Promise(resolve => { finish = resolve; }); p.cancel = () => finish(); return p; }
  }
  const { NativeEngineSplash } = load('../../../bridge/branding/engine-splash.ts', {
    '@nativescript/core': { GridLayout: View, StackLayout: View, Image: View, Label: View, Color: class {}, Device: { language: 'zh-CN' } },
  });
  const parent = new View(), splash = new NativeEngineSplash(parent);
  assert.equal(parent.children.length, 1);
  assert.equal(animations, 0);
  splash.presented(); splash.presented();
  assert.equal(animations, 1);
  splash.fail(); finish(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(splash.view.visibility, 'visible');
  assert.equal(splash.view.opacity, 1);
  splash.dispose(); assert.equal(parent.children.length, 0);
  assert.equal(parent.listeners.size, 0);
  splash.dispose(); splash.presented(); splash.fail();
  assert.equal(splash.status, 'disposed');
  const next = new NativeEngineSplash(parent);
  next.presented(); finish(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(next.view.visibility, 'collapse');
  next.dispose();
});
test('shared splash scales for portrait, landscape and small windows, and relayouts on rotation', () => {
  class View {
    children=[]; listeners=new Map(); size={width:430,height:932};
    addChild(child) { this.children.push(child); }
    removeChild(child) { this.children=this.children.filter(c=>c!==child); }
    getActualSize() { return this.size; }
    on(event,handler) { this.listeners.set(event,handler); }
    off(event) { this.listeners.delete(event); }
  }
  const core={GridLayout:View,StackLayout:View,Image:View,Label:View,Page:View,Color:class{},Device:{language:'zh-CN'}};
  const branding=load('../../../bridge/branding/engine-splash.ts',{'@nativescript/core':core});
  for(const [w,h] of [[430,932],[320,568],[932,430],[640,320],[240,240]]) {
    const l=branding.engineSplashLayout(w,h);
    assert(l.contentWidth<=w-40); assert(l.logo>=64);
    assert(l.logo+l.gap+32+7+14+l.captionGap+32 < h-30);
  }
  assert(branding.engineSplashLayout(430,932).logo>branding.engineSplashLayout(932,430).logo);
  const parent=new View(),splash=new branding.NativeEngineSplash(parent);
  const content=splash.view.children[0],portraitLogo=content.children[0].width;
  parent.size={width:932,height:430};parent.listeners.get('layoutChanged')();
  assert(content.children[0].width<portraitLogo); assert.equal(content.translateY,0);
  splash.setMessage('正在恢复棋局');assert.equal(content.children[3].text,'正在恢复棋局');
  const {NativeEngineLaunchPage}=load('../../../bridge/branding/launch-page.ts',{'@nativescript/core':core,'./engine-splash':branding});
  const page=new NativeEngineLaunchPage({orientation:'portrait'});
  assert.equal(page.content.children[0],page.gameRoot);
  assert.equal(page.content.children[1],page.splash.view);
  assert.equal(page.gameRoot.iosOverflowSafeArea,false);
  assert.equal(page.content.iosOverflowSafeArea,true);
  assert.equal(page.androidOverflowEdge,'ignore');
  assert.equal(page.content.androidOverflowEdge,'ignore');
  assert.equal(page.gameRoot.androidOverflowEdge,'none');
  assert.equal(page.splash.status,'loading');
  splash.dispose();page.splash.dispose();
});
test('normal play presents every frame without periodic snapshot serialization or disk writes', () => {
  for (const interval of [0, 120]) {
    let writes = 0, snapshots = 0;
    const frames = [];
    class Surface {
      hasLayout = false;
      presentedFrames = 0;
      present() { this.presentedFrames++; return true; }
    }
    const { NativeRenderHost } = load('../../../bridge/lifecycle/host.ts', {
      '@nativescript/core': { Application: { on() {} }, File: { fromPath: () => ({ writeTextSync() { writes++; } }) }, knownFolders: { documents: () => ({ path: '/test' }) }, path: { join: (...p) => p.join('/') }, isAndroid: true },
      '@haiyue/engine': {}, '@haiyue/engine/diagnostics': {},
      './presentation-pause': load('../../../bridge/lifecycle/presentation-pause.ts', {}),
      './frame-performance': { FramePerformance: class {} },
      './demand-frames': {},
      '../render/surface': { NativeSurface: Surface },
      '../render/frame-capture': { isFrameCaptureRequested: () => false },
      './runtime': { installNativeFrameRuntime() {}, nativeFrames: { pendingCount: 1 } },
    });
    const host = new NativeRenderHost({ on() {} }, text => frames.push(text), { diagnosticIntervalFrames: interval });
    host.input = { snapshot() { snapshots++; return {}; } };
    for (let i = 0; i < 600; i++) host.afterFrame();
    assert.equal(host.surface.presentedFrames, 600);
    assert.equal(snapshots, interval ? 6 : 1);
    assert.equal(writes, interval ? 7 : 2);
    assert.equal(frames.length, interval ? 6 : 1);
  }
});
