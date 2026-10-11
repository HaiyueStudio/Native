import { createCanvas, loadImage } from '@napi-rs/canvas';
import { DesktopAudio } from './audio';
import { DesktopStorage } from './storage';

export async function runDesktopProbes(device: GPUDevice, directory: string, audioLibrary?: string) {
  const storage = new DesktopStorage(directory);
  const key = '中文/../path-is-a-key:' + 'x'.repeat(500);
  storage.setItem(key, 'one'); storage.setItem(key, 'two');
  if (new DesktopStorage(directory).getItem(key) !== 'two') throw new Error('Atomic storage roundtrip failed');
  storage.removeItem(key);

  const source = createCanvas(2, 2); source.getContext('2d').fillStyle = '#ff0000'; source.getContext('2d').fillRect(0, 0, 2, 2);
  const decoded = await loadImage(source.toBuffer('image/png'));
  const image = createCanvas(2, 2); image.getContext('2d').drawImage(decoded, 0, 0);
  const pixels = image.getContext('2d').getImageData(0, 0, 2, 2).data;
  const texture = device.createTexture({ size: [2, 2], format: 'rgba8unorm', usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC });
  const buffer = device.createBuffer({ size: 512, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  try {
    device.queue.writeTexture({ texture }, pixels, { bytesPerRow: 8 }, [2, 2]);
    const encoder = device.createCommandEncoder(); encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow: 256 }, [2, 2]);
    device.queue.submit([encoder.finish()]); await buffer.mapAsync(GPUMapMode.READ);
    const output = new Uint8Array(buffer.getMappedRange());
    if (output[0] !== 255 || output[1] !== 0 || output[3] !== 255 || output[256] !== 255) throw new Error('Image GPU roundtrip failed');
  } finally { buffer.unmap(); buffer.destroy(); texture.destroy(); }

  const url = URL.createObjectURL(new Blob([`self.onmessage = e => {const values = new Uint32Array(e.data); values[0] += 1; self.postMessage(values.buffer, [values.buffer]);};`], { type: 'text/javascript' }));
  const worker = new Worker(url, { type: 'module' });
  try {
    const input = new Uint32Array([41]);
    const result = new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Worker timeout')), 5000);
      worker.onmessage = e => { clearTimeout(timeout); resolve(new Uint32Array(e.data)[0]); };
      worker.onerror = e => { clearTimeout(timeout); reject(new Error(e.message)); };
    });
    worker.postMessage(input.buffer, [input.buffer]);
    if (input.byteLength !== 0 || await result !== 42) throw new Error('Worker transferable roundtrip failed');
  } finally { worker.terminate(); URL.revokeObjectURL(url); }

  let audio = 'not-tested';
  if (audioLibrary) {
    const file = `${directory}/probe.wav`, frames = 2205, wav = new Uint8Array(44 + frames * 2), view = new DataView(wav.buffer);
    const text = (at: number, value: string) => wav.set(new TextEncoder().encode(value), at);
    text(0, 'RIFF'); view.setUint32(4, wav.length - 8, true); text(8, 'WAVEfmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 22050, true); view.setUint32(28, 44100, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, frames * 2, true);
    for (let i = 0; i < frames; i++) view.setInt16(44 + i * 2, Math.sin(i * 2 * Math.PI * 440 / 22050) * 1000, true);
    await Deno.writeFile(file, wav); const player = new DesktopAudio(audioLibrary);
    try { player.play(file); await new Promise(r => setTimeout(r, 150)); player.pause(); player.resume(); audio = 'device-playback-api-passed'; }
    finally { player.dispose(); await Deno.remove(file); }
  }
  return { storage: 'passed', imageDecodeAndGpuReadback: 'passed', workerTransferAndTerminate: 'passed', audio };
}
