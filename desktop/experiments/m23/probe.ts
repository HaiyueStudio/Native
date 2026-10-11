// Raw OS surface probe. No HTML server, DOM, Chromium or WebView.
console.log(JSON.stringify({ probe: 'host', deno: Deno.version, build: Deno.build,
  browserWindow: typeof Deno.BrowserWindow, document: 'document' in globalThis }));
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error('No native WebGPU adapter');
const device = await adapter.requestDevice();
const window = new Deno.BrowserWindow({ title: 'Haiyue native wgpu probe', width: 800, height: 600 });
console.log(JSON.stringify({ probe: 'window', prototype: Object.getOwnPropertyNames(Object.getPrototypeOf(window)), adapter: adapter.info }));
const surface = window.getNativeWindow();
const context = surface.getContext('webgpu') as GPUCanvasContext;
context.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'opaque' });
const [width, height] = window.getSize();
surface.width = width; surface.height = height;
for (const kind of ['resize', 'focus', 'blur', 'keydown', 'keyup', 'pointerdown', 'pointermove', 'pointerup', 'wheel', 'close']) {
  window.addEventListener(kind, (event) => console.log(JSON.stringify({ probe: 'event', kind, event })));
}
let frames = 0;
const timer = setInterval(() => {
  const encoder = device.createCommandEncoder();
  encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(),
    clearValue: { r: 0.02, g: 0.15, b: 0.3, a: 1 }, loadOp: 'clear', storeOp: 'store' }] }).end();
  device.queue.submit([encoder.finish()]); surface.present();
  if (++frames === 120) { clearInterval(timer); console.log(JSON.stringify({ probe: 'presented', frames })); device.destroy(); Deno.exit(0); }
}, 16);
