import '@formatjs/intl-getcanonicallocales/polyfill.js';
import { Application, Button, StackLayout, GridLayout, ScrollView, Label, Image, ImageSource, File, knownFolders, Color, isIOS } from '@nativescript/core';
import { Canvas } from '@nativescript/canvas';
import NativeURL from 'core-js-pure/actual/url';
import { Entity, type HaiyueEngine } from '@haiyue/engine';
import { GuiRoot, GuiLabel } from '@haiyue/engine/gui';
import { I18n } from '@haiyue/extensions/i18n';
import { captureShareImage, prepareShareContent, parseChallengeLink, type PreparedShareContent, type ShareCardSurface } from '@haiyue/extensions/share-content';
import { shareContent, canShareContent } from '@haiyue/native/share';
import { NativeRenderHost } from '@haiyue/native/bridge/lifecycle/host';
import { NativeCanvasTextures } from '@haiyue/native/bridge/render/canvas-textures.ios';
import { nativeLaunchFlag } from '@haiyue/native/bridge/lifecycle/launch-flags';

if (typeof globalThis.URL === 'undefined') Object.defineProperty(globalThis, 'URL', { configurable: true, value: NativeURL });
const directory = knownFolders.documents().path;
const journal = File.fromPath(directory + '/share-content-validation.jsonl');
let lines = '', status: Label, host: NativeRenderHost | undefined, engine: HaiyueEngine | undefined;
let current: PreparedShareContent | undefined, generating = false, pendingCapture: (() => void) | undefined;
let canvas: Canvas, preview: Image, shareButton: Button, verifyButton: Button, variantButton: Button;
let locale = 'zh-CN', portrait = false;
let i18n: I18n;
const messages = {
  'zh-CN': { title: '专家数独 · 最佳纪录', subtitle: '每一道挑战，都有新的可能。', badge: 'HAIYUE / 每日挑战', time: '完成时间', hints: '使用提示', footer: '同题挑战 · 规则 v3 · 演示战绩', share: '我用 {time} 完成专家数独，零提示！来挑战同一道题。' },
  en: { title: 'Expert Sudoku · Personal Best', subtitle: 'A new challenge. A new possibility.', badge: 'HAIYUE / DAILY CHALLENGE', time: 'Completion time', hints: 'Hints used', footer: 'Same puzzle · Rules v3 · Demo result', share: 'Expert Sudoku in {time}, without hints! Try the same puzzle.' },
};
function log(event: string, data: unknown = {}) {
  const row = {time: new Date().toISOString(), platform: isIOS ? 'ios' : 'android', event, data};
  lines += JSON.stringify(row) + '\n'; journal.writeTextSync(lines); console.log('SHARE_VALIDATION ' + JSON.stringify(row));
  if (status) status.text = event + '\n' + JSON.stringify(data);
}
function nativeBytes(bytes: Uint8Array): any {
  if (isIOS) return NSData.dataWithBytesLength(interop.handleof(bytes.buffer), bytes.byteLength);
  const result = Array.create('byte', bytes.length);
  for (let i = 0; i < bytes.length; i++) result[i] = bytes[i] > 127 ? bytes[i] - 256 : bytes[i];
  return result;
}
function save(name: string, bytes: Uint8Array): ImageSource {
  const path = directory + '/' + name;
  File.fromPath(path).writeSync(nativeBytes(bytes), error => { throw error; });
  const image = ImageSource.fromFileSync(path);
  if (!image) throw new Error('Cannot decode ' + name);
  return image;
}
function surface(width: number, height: number): ShareCardSurface {
  const output = new Canvas(); output.width = width; output.height = height;
  output.getContext('2d', {willReadFrequently: true});
  return output as unknown as ShareCardSurface;
}
function brightPixels(image: ImageSource): number {
  const probe = surface(image.width, image.height) as unknown as Canvas;
  try {
    const context = probe.getContext('2d')!; context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 150 && pixels[i + 1] > 150 && pixels[i + 2] > 150) count++;
    return count;
  } finally { probe.width = 0; probe.height = 0; }
}
function fingerprint(bytes: Uint8Array): string {
  let hash = 2166136261; for (const value of bytes) hash = Math.imul(hash ^ value, 16777619);
  return (hash >>> 0).toString(16);
}
async function generate(): Promise<PreparedShareContent> {
  await i18n.setLocale(locale);
  // Registered in prepareScene, before NativeRenderHost's present listener. The encoder runs
  // synchronously here while the submitted swapchain texture is still acquired.
  const screenshot = await new Promise<Awaited<ReturnType<typeof captureShareImage>>>((resolve, reject) => {
    const timeout = setTimeout(() => {pendingCapture = undefined; reject(new Error('GPU capture timeout'));}, 10000);
    pendingCapture = () => { clearTimeout(timeout); void captureShareImage(canvas).then(resolve, reject); };
    host!.requestFrame();
  });
  const source = save('share-source.png', screenshot.bytes), bright = brightPixels(source);
  if (source.width < 300 || source.height < 300 || bright < 1000) throw new Error('Captured board is blank or undersized');
  const result = await prepareShareContent({title: {key: 'title'}, text: {key: 'share', params: {time: '06:32'}},
    challenge: {baseUrl: 'https://example.com/challenge', data: {gameId: 'sudoku-demo', rulesVersion: 'v3', mode: 'expert', seed: '104729'}},
    card: {width: portrait ? 900 : 1200, height: portrait ? 1200 : 630, title: {key: 'title'}, subtitle: {key: 'subtitle'}, badge: {key: 'badge'}, footer: {key: 'footer'},
      stats: [{label: {key: 'time'}, value: '06:32'}, {label: {key: 'hints'}, value: '0'}],
      image: {source: source as unknown as CanvasImageSource, width: source.width, height: source.height, fit: 'contain'}},
  }, {i18n, createCanvas: surface, filename: `result-${locale}-${portrait ? 'portrait' : 'landscape'}.png`});
  const decoded = save(result.image.filename, result.image.bytes);
  if (decoded.width !== result.image.width || decoded.height !== result.image.height || brightPixels(decoded) < 1000) throw new Error('Invalid card pixels or size');
  const parsed = parseChallengeLink(result.url!, {gameId:'sudoku-demo', rulesVersion:'v3', allowedOrigins:['https://example.com']});
  if (parsed?.seed !== '104729') throw new Error('Challenge round trip failed');
  preview.src = decoded; preview.height = portrait ? 280 : 180;
  current = result;
  log('card-ready', {locale, portrait, width: decoded.width, height: decoded.height, bytes: result.image.bytes.length, sourceBrightPixels: bright, fingerprint: fingerprint(result.image.bytes), title: result.title, text: result.text, challenge: parsed, canShare: canShareContent(result)});
  return result;
}
async function run(verify = false): Promise<void> {
  if (generating || !engine) return;
  generating = true; shareButton.isEnabled = false; verifyButton.isEnabled = false; variantButton.isEnabled = false;
  try {
    if (verify) {
      const hashes: string[] = [];
      for (const language of ['zh-CN', 'en']) for (const vertical of [false, true]) {
        locale = language; portrait = vertical; hashes.push(fingerprint((await generate()).image.bytes));
      }
      if (new Set(hashes).size !== 4) throw new Error('Variants must differ');
      locale = 'zh-CN'; portrait = false; await generate(); log('verification-passed', {variants: 4, hashes});
    } else await generate();
  } catch (error) { current = undefined; log('generation-error', String(error) + '\n' + (error as Error).stack); }
  finally { generating = false; shareButton.isEnabled = !!current; verifyButton.isEnabled = true; variantButton.isEnabled = true; }
}
async function share(textOnly = false): Promise<void> {
  if (!current) return;
  const release = host!.pausePresentation();
  try {
    const payload = textOnly ? {title: current.title, text: current.text, url: current.url} : current;
    log('share-start', {textOnly, bytes: textOnly ? 0 : current.image.bytes.length});
    log('share-result', await shareContent(payload));
  } catch (error) { log('share-error', String(error)); }
  finally { release(); }
}
// Explicit device probe only; leaves the actual sheet open for user cancellation.
function probeShareSheet(): void {
  if (!isIOS || !nativeLaunchFlag('SHARE_CONTENT_PRESENT')) return;
  void share();
  setTimeout(() => {
    try {
      const root = Application.ios.rootController, controller = root.presentedViewController;
      if (!(controller instanceof UIActivityViewController)) throw new Error('Share controller not presented');
      const window = root.view.window;
      const renderer = UIGraphicsImageRenderer.alloc().initWithBounds(window.bounds);
      const screenshot = renderer.imageWithActions(() => {window.drawViewHierarchyInRectAfterScreenUpdates(window.bounds, true);});
      File.fromPath(directory + '/share-system-sheet.png').writeSync(UIImagePNGRepresentation(screenshot));
      log('share-sheet-presented', {controller:'UIActivityViewController', attached:!!controller.view.window, image:current?.image.filename});
    } catch (error) {log('share-probe-error',String(error));}
  }, 2500);
}
Application.run({create: () => {
  const root = new StackLayout(); root.padding = '48 12 16 12'; root.backgroundColor = '#edf5ff'; root.color = new Color('#102438');
  status = new Label(); status.textWrap = true; status.fontSize = 10;
  try {
    log('runtime-ready', {intl: typeof Intl, canonicalLocales: typeof Intl === 'undefined' ? 'missing' : typeof Intl.getCanonicalLocales});
    i18n = new I18n({locale:'zh-CN',fallbackLocale:'en'});
    for (const [locale, entries] of Object.entries(messages)) i18n.register({schemaVersion:1,locale,messages:entries});
  } catch (error) {log('startup-error', String(error));root.addChild(status);return root;}
  const title = new Label(); title.text = 'Share Content Validation'; title.fontSize = 21; root.addChild(title);
  function button(text: string, action: () => void): Button { const view = new Button(); view.text = text; view.height = 44; view.on('tap', action); root.addChild(view); return view; }
  shareButton = button('Share card', () => void share()); shareButton.isEnabled = false;
  button('Share text', () => void share(true));
  variantButton = button('Switch language / layout', () => {locale = locale === 'zh-CN' ? 'en' : 'zh-CN'; portrait = !portrait; void run();});
  verifyButton = button('Verify four variants', () => void run(true));
  // Keep layout dimensions in the container. Explicit Canvas dimensions select ScaleDown
  // on Android and feed the resized drawing buffer back into future layout measurements.
  const board = new GridLayout(); board.width = 170; board.height = 170; board.horizontalAlignment = 'center';
  canvas = new Canvas(); canvas.style.height = '100%'; canvas.style.width = '100%'; board.addChild(canvas); root.addChild(board);
  preview = new Image(); preview.stretch = 'aspectFit'; preview.height = 180; root.addChild(preview);
  root.addChild(status);
  canvas.on('ready', () => {
    if (host) return;
    log('canvas-ready');
    host = new NativeRenderHost(canvas, text => log('gpu-status', text), {diagnosticName:'share-content', diagnosticIntervalFrames:0,
      prepareScene(value) {
        engine = value; const textures = new NativeCanvasTextures(value.device);
        const scene = value.createScene({name:'share-board',render3D:false,render2D:false,gui:{loadOp:'clear',font:{chars:'123456789',fontFamily:'sans-serif',atlasSize:512,canvasFactory:textures.createCanvas2D,readAtlasPixels:textures.readAtlasPixels}}});
        const gui = new GuiRoot(); scene.add(new Entity('board').addComponent(gui));
        const digits = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
        for (let i = 0; i < 81; i++) {
          const row = Math.floor(i / 9), column = i % 9;
          const cell = gui.add(new GuiLabel({text:digits[i],fontSize:12,textAlign:'center',style:{color:'#e4f2ff',backgroundColor:(Math.floor(row/3)+Math.floor(column/3))%2?'#284963':'#1a334b'}}));
          cell.layout = bounds => {const size = Math.min(bounds.width,bounds.height)/9;cell.rect={x:column*size+1,y:row*size+1,width:size-2,height:size-2};};
        }
        value.switchScene(scene);
        let first = true;
        value.on('after-update', () => {const callback=pendingCapture;pendingCapture=undefined;callback?.();if(first){first=false;setTimeout(()=>void run(true).then(()=>{if(current)probeShareSheet();}),100);}});
        return {board:'GPU GUI',capture:'before present'};
      },
    });
  });
  const scroll = new ScrollView(); scroll.content = root; log('ready'); return scroll;
}});
Application.on(Application.exitEvent, () => {host?.dispose();i18n?.dispose();});
