import { createGameCenterQueueClient } from '../../../bridge/achievements/game-center/queue-client';
// GameKit may hold completion closures after stop(). Their code must remain mapped until exit.
const openLibrary = (path: string) => Deno.dlopen(path, {
  hy_gc_abi: { parameters: [], result: 'i32' }, hy_gc_start: { parameters: ['buffer'], result: 'void' },
  hy_gc_request: { parameters: ['buffer'], result: 'i32' }, hy_gc_session: { parameters: ['buffer', 'i32'], result: 'i32' },
  hy_gc_poll: { parameters: ['buffer', 'i32'], result: 'i32' }, hy_gc_stop: { parameters: [], result: 'void' },
});
let retainedLibrary: { path: string; lib: ReturnType<typeof openLibrary> } | undefined;
let activeOwner = false;
export function createDesktopGameCenterClient(path: string) {
  if (activeOwner) throw new Error('A desktop Game Center client already owns this process');
  path = Deno.realPathSync(path);
  // Reusing the mapped image also avoids accumulating handles on account reinitialization.
  if (retainedLibrary && retainedLibrary.path !== path) throw new Error('Restart the process to change the Game Center library');
  const lib = retainedLibrary?.lib ?? openLibrary(path);
  if (lib.symbols.hy_gc_abi() !== 1) { lib.close(); throw new Error('Unsupported Game Center ABI'); }
  retainedLibrary = { path, lib };
  activeOwner = true;
  const buffer = new Uint8Array(4 * 1024 * 1024), encoder = new TextEncoder(), decoder = new TextDecoder();
  const cstr = (s: string) => { if (s.includes('\0')) throw new Error('Invalid string'); return encoder.encode(s + '\0'); };
  const read = (fn: typeof lib.symbols.hy_gc_poll) => { const n = fn(buffer, buffer.length); if (n < 0) throw new Error('GameKit event buffer overflow'); return decoder.decode(buffer.subarray(0, n)); };
  let closed = false;
  return createGameCenterQueueClient({ start: id => lib.symbols.hy_gc_start(cstr(id)), session: () => read(lib.symbols.hy_gc_session),
    request: json => lib.symbols.hy_gc_request(cstr(json)) === 1, poll: () => read(lib.symbols.hy_gc_poll),
    stop() { if (!closed) { closed = true; lib.symbols.hy_gc_stop(); activeOwner = false; } },
  });
}
