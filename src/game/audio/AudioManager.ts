import { SOUND_URLS, type SoundName } from '../assets/assetManifest';

export interface PlayOptions {
  volume?: number;
  /** Playback rate; small random variations keep repeated cannon shots from sounding identical. */
  rate?: number;
  /** Ignore calls arriving sooner than this after the previous play of the same sound. */
  minIntervalMs?: number;
}

export interface LoopHandle {
  setVolume(volume: number, rampSeconds?: number): void;
  stop(): void;
}

/** Simultaneous voices per sound; a full broadside volley should not stack into a roar. */
const MAX_VOICES_PER_SOUND = 4;

/**
 * Thin Web Audio wrapper shared by menus and matches. The AudioContext is
 * only created after the first user gesture (browser autoplay rules), and
 * audio is optional: a missing or undecodable file simply stays silent.
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  /** Files fetched before the context existed; decoded on unlock. */
  private readonly pendingData = new Map<string, ArrayBuffer>();
  private readonly voices = new Map<string, number>();
  private readonly lastPlayedAt = new Map<string, number>();
  private readonly loops = new Set<LoopHandle>();
  private muted = false;

  get isMuted(): boolean {
    return this.muted;
  }

  get activeLoopCount(): number {
    return this.loops.size;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.02);
  }

  /** Call from a user gesture handler. Safe to call repeatedly. */
  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
    for (const [name, data] of this.pendingData) {
      this.pendingData.delete(name);
      void this.decode(name, data);
    }
  }

  /** Fetches every sound, reporting each completion; failures are tolerated. */
  async preload(names: readonly string[], onFileDone: () => void): Promise<void> {
    await Promise.all(
      names.map(async (name) => {
        try {
          if (this.buffers.has(name) || this.pendingData.has(name)) return;
          const url = SOUND_URLS[name];
          if (!url) return;
          const response = await fetch(url);
          if (!response.ok) return;
          const data = await response.arrayBuffer();
          if (this.context) await this.decode(name, data);
          else this.pendingData.set(name, data);
        } catch {
          // Sound is a nice-to-have: a failed file must never block the battle.
        } finally {
          onFileDone();
        }
      }),
    );
  }

  play(name: SoundName, options: PlayOptions = {}): void {
    const context = this.context;
    const buffer = this.buffers.get(name);
    if (!context || !this.master || !buffer || context.state !== 'running') return;
    const active = this.voices.get(name) ?? 0;
    if (active >= MAX_VOICES_PER_SOUND) return;
    if (options.minIntervalMs !== undefined) {
      const now = context.currentTime * 1000;
      if (now - (this.lastPlayedAt.get(name) ?? -Infinity) < options.minIntervalMs) return;
      this.lastPlayedAt.set(name, now);
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options.rate ?? 1;
    const gain = context.createGain();
    gain.gain.value = options.volume ?? 1;
    source.connect(gain).connect(this.master);
    this.voices.set(name, active + 1);
    source.onended = () => {
      this.voices.set(name, Math.max(0, (this.voices.get(name) ?? 1) - 1));
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  }

  loop(name: SoundName, volume: number): LoopHandle {
    const context = this.context;
    const buffer = this.buffers.get(name);
    if (!context || !this.master || !buffer) return SILENT_LOOP;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(volume, context.currentTime, 0.3);
    source.connect(gain).connect(this.master);
    source.start();

    let stopped = false;
    const handle: LoopHandle = {
      setVolume: (next, rampSeconds = 0.15) => {
        if (!stopped) gain.gain.setTargetAtTime(next, context.currentTime, rampSeconds / 3);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        this.loops.delete(handle);
        source.stop();
        source.disconnect();
        gain.disconnect();
      },
    };
    this.loops.add(handle);
    return handle;
  }

  private async decode(name: string, data: ArrayBuffer): Promise<void> {
    if (!this.context) return;
    try {
      this.buffers.set(name, await this.context.decodeAudioData(data));
    } catch {
      // Undecodable sound stays silent.
    }
  }
}

const SILENT_LOOP: LoopHandle = { setVolume: () => undefined, stop: () => undefined };
