/** Optional native playback service; failure is explicit and does not block rendering. */
export class DesktopAudio {
  private readonly library;
  private disposed = false;
  constructor(path: string) {
    this.library = Deno.dlopen(path, {
      haiyue_audio_version: { parameters: [], result: 'i32' }, haiyue_audio_init: { parameters: [], result: 'i32' },
      haiyue_audio_play: { parameters: ['buffer'], result: 'i32' }, haiyue_audio_pause: { parameters: [], result: 'i32' },
      haiyue_audio_resume: { parameters: [], result: 'i32' }, haiyue_audio_dispose: { parameters: [], result: 'void' },
    });
    if (this.library.symbols.haiyue_audio_version() !== 1) { this.library.close(); throw new Error('Unsupported audio ABI'); }
    const result = this.library.symbols.haiyue_audio_init();
    if (result !== 0) { this.library.close(); throw new Error(`Audio device unavailable: ${result}`); }
  }
  play(path: string): void {
    this.check(); if (path.includes('\0')) throw new Error('Invalid audio path');
    this.result(this.library.symbols.haiyue_audio_play(new TextEncoder().encode(`${path}\0`)));
  }
  pause() { this.check(); this.result(this.library.symbols.haiyue_audio_pause()); }
  resume() { this.check(); this.result(this.library.symbols.haiyue_audio_resume()); }
  dispose() { if (!this.disposed) { this.disposed = true; this.library.symbols.haiyue_audio_dispose(); this.library.close(); } }
  private check() { if (this.disposed) throw new Error('Audio disposed'); }
  private result(code: number) { if (code !== 0) throw new Error(`Native audio failed: ${code}`); }
}
