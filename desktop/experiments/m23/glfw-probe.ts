const lib = Deno.dlopen(Deno.args[0], {
  glfwInit: { parameters: [], result: 'i32' },
  glfwWindowHint: { parameters: ['i32', 'i32'], result: 'void' },
  glfwCreateWindow: { parameters: ['i32', 'i32', 'buffer', 'pointer', 'pointer'], result: 'pointer' },
  glfwGetCocoaWindow: { parameters: ['pointer'], result: 'pointer' },
  glfwGetCocoaView: { parameters: ['pointer'], result: 'pointer' },
  glfwPollEvents: { parameters: [], result: 'void' },
  glfwDestroyWindow: { parameters: ['pointer'], result: 'void' },
  glfwTerminate: { parameters: [], result: 'void' },
});
if (!lib.symbols.glfwInit()) throw new Error('GLFW init failed');
lib.symbols.glfwWindowHint(0x00022001, 0); // GLFW_CLIENT_API = GLFW_NO_API
const window = lib.symbols.glfwCreateWindow(800, 600, new TextEncoder().encode('Haiyue GLFW wgpu\0'), null, null);
if (!window) throw new Error('GLFW window failed');
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error('No adapter');
const device = await adapter.requestDevice();
const surface = new Deno.UnsafeWindowSurface({ system: 'cocoa', windowHandle: lib.symbols.glfwGetCocoaWindow(window),
  displayHandle: lib.symbols.glfwGetCocoaView(window), width: 800, height: 600 });
const context = surface.getContext('webgpu') as GPUCanvasContext;
context.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'opaque' });
for (let frame = 0; frame < 120; frame++) {
  lib.symbols.glfwPollEvents();
  const encoder = device.createCommandEncoder();
  encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store',
    clearValue: { r: 0.02, g: 0.3, b: 0.15, a: 1 } }] }).end();
  device.queue.submit([encoder.finish()]); surface.present();
  await new Promise(resolve => setTimeout(resolve, 16));
}
await device.queue.onSubmittedWorkDone(); context.unconfigure(); device.destroy();
lib.symbols.glfwDestroyWindow(window); lib.symbols.glfwTerminate(); lib.close();
console.log(JSON.stringify({ probe: 'glfw-presented', frames: 120, document: 'document' in globalThis, runtime: Deno.version, adapter: adapter.info }));
