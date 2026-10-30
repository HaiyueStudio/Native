import type {HyaPlayer} from '@haiyue/extensions/hya-player';
type Playback = Pick<HyaPlayer, 'status' | 'pause' | 'resume' | 'unlockAudio'>;

/** Native suspension requires a new real gesture before resuming sample-accurate audio. */
export class NativePlaybackUnlock {
  private resumePending = false;
  private revision = 0;
  private disposed = false;
  get pending(): boolean {return this.resumePending;}
  pause(player: Playback | null): void {
    if (this.disposed) return;
    ++this.revision;
    if (player?.status === 'running') {player.pause(); this.resumePending = true;}
  }
  async unlock(player: Playback): Promise<void> {
    if (this.disposed) throw new Error('Native playback owner is closed.');
    const revision = this.revision;
    // Enter native unlock synchronously in the caller's actual tap/VoiceOver action.
    await player.unlockAudio();
    if (this.disposed || revision !== this.revision) return;
    if (this.resumePending) {player.resume(); this.resumePending = false;}
  }
  dispose(): void {this.disposed = true; ++this.revision; this.resumePending = false;}
}
