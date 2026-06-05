import { resolveAudioSettings } from "../shared/AudioSettings";
import type { AmbientMusic, AudioSettings } from "../shared/types/MapSchema";

export type AudioCue =
  | "coin"
  | "checkpoint"
  | "door"
  | "button"
  | "jumpPad"
  | "teleporter"
  | "key"
  | "item"
  | "damage"
  | "death"
  | "victory"
  | "uiClick"
  | "disappearingBlock"
  | "message"
  | "attack"
  | "blaster"
  | "hit";

type LocalAudioPreferences = {
  masterVolume?: number;
  muted?: boolean;
};

type CueDefinition = {
  frequencies: number[];
  duration: number;
  type: OscillatorType;
  volume: number;
  gap?: number;
};

const LOCAL_SETTINGS_KEY = "mini-blox-settings";

export class AudioSystem {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private mapSettings = resolveAudioSettings();
  private settings = resolveAudioSettings();
  private localPreferences: LocalAudioPreferences = readLocalAudioPreferences();
  private readonly lastPlayedAt = new Map<AudioCue, number>();
  private musicTimer = 0;
  private musicStep = 0;

  applySettings(settings?: AudioSettings): void {
    this.mapSettings = resolveAudioSettings(settings);
    this.settings = {
      ...this.mapSettings,
      masterVolume: this.localPreferences.masterVolume ?? this.mapSettings.masterVolume,
      muted: Boolean(this.mapSettings.muted || this.localPreferences.muted),
    };
    this.updateGainValues();
    this.updateAmbientMusic();
  }

  play(cue: AudioCue): void {
    if (this.settings.muted) {
      return;
    }

    const now = performance.now();
    const throttleMs = getCueThrottleMs(cue);
    const lastPlayedAt = this.lastPlayedAt.get(cue) ?? 0;

    if (now - lastPlayedAt < throttleMs) {
      return;
    }

    this.lastPlayedAt.set(cue, now);
    const definition = CUE_DEFINITIONS[cue];
    const context = this.getContext();

    if (!context || !this.sfxGain) {
      return;
    }

    const sfxGain = this.sfxGain;
    void context.resume();
    definition.frequencies.forEach((frequency, index) => {
      this.playTone(context, sfxGain, frequency, definition, index);
    });
  }

  setMuted(muted: boolean): void {
    this.localPreferences = {
      ...this.localPreferences,
      muted,
    };
    writeLocalAudioPreferences(this.localPreferences);
    this.applySettings(this.mapSettings);
  }

  toggleMuted(): boolean {
    const muted = !this.settings.muted;
    this.setMuted(muted);
    return muted;
  }

  isMuted(): boolean {
    return this.settings.muted;
  }

  dispose(): void {
    window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
    this.masterGain?.disconnect();
    this.sfxGain?.disconnect();
    this.musicGain?.disconnect();
    void this.context?.close();
    this.context = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
  }

  private getContext(): AudioContext | null {
    if (this.context) {
      return this.context;
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) {
      return null;
    }

    this.context = new AudioContextConstructor();
    this.masterGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
    this.updateGainValues();
    return this.context;
  }

  private updateGainValues(): void {
    if (!this.masterGain || !this.sfxGain || !this.musicGain) {
      return;
    }

    const masterVolume = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.setTargetAtTime(masterVolume, this.masterGain.context.currentTime, 0.02);
    this.sfxGain.gain.setTargetAtTime(
      this.settings.sfxVolume,
      this.sfxGain.context.currentTime,
      0.02
    );
    this.musicGain.gain.setTargetAtTime(
      this.settings.musicVolume,
      this.musicGain.context.currentTime,
      0.08
    );
  }

  private playTone(
    context: AudioContext,
    targetGain: GainNode,
    frequency: number,
    definition: CueDefinition,
    index: number
  ): void {
    const start = context.currentTime + index * (definition.gap ?? 0.045);
    const duration = definition.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = definition.type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, definition.volume), start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(targetGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    oscillator.addEventListener(
      "ended",
      () => {
        oscillator.disconnect();
        gain.disconnect();
      },
      { once: true }
    );
  }

  private updateAmbientMusic(): void {
    window.clearInterval(this.musicTimer);
    this.musicTimer = 0;

    if (this.settings.ambientMusic === "none" || this.settings.muted) {
      return;
    }

    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => {
      this.playMusicStep(this.settings.ambientMusic);
    }, 650);
  }

  private playMusicStep(music: AmbientMusic): void {
    if (music === "none") {
      return;
    }

    const context = this.getContext();

    if (!context || !this.musicGain || this.settings.muted) {
      return;
    }

    const musicGain = this.musicGain;
    void context.resume();
    const notes = MUSIC_PATTERNS[music];
    const frequency = notes[this.musicStep % notes.length];
    this.musicStep += 1;
    this.playTone(
      context,
      musicGain,
      frequency,
      {
        frequencies: [frequency],
        duration: 0.34,
        type: music === "neon" ? "triangle" : "sine",
        volume: music === "dark" ? 0.045 : 0.055,
      },
      0
    );
  }
}

const CUE_DEFINITIONS: Record<AudioCue, CueDefinition> = {
  coin: { frequencies: [880, 1320], duration: 0.12, type: "triangle", volume: 0.12 },
  checkpoint: { frequencies: [523, 659, 784], duration: 0.13, type: "sine", volume: 0.11 },
  door: {
    frequencies: [196, 245, 294],
    duration: 0.18,
    type: "sawtooth",
    volume: 0.075,
    gap: 0.035,
  },
  button: { frequencies: [370, 554], duration: 0.08, type: "square", volume: 0.075 },
  jumpPad: {
    frequencies: [330, 660, 990],
    duration: 0.11,
    type: "triangle",
    volume: 0.1,
    gap: 0.03,
  },
  teleporter: {
    frequencies: [740, 622, 932],
    duration: 0.18,
    type: "sine",
    volume: 0.08,
    gap: 0.025,
  },
  key: { frequencies: [988, 1175], duration: 0.1, type: "triangle", volume: 0.105 },
  item: { frequencies: [587, 784], duration: 0.1, type: "triangle", volume: 0.095 },
  damage: { frequencies: [180], duration: 0.2, type: "sawtooth", volume: 0.11 },
  death: {
    frequencies: [240, 180, 120],
    duration: 0.18,
    type: "sawtooth",
    volume: 0.1,
    gap: 0.055,
  },
  victory: {
    frequencies: [523, 659, 784, 1046],
    duration: 0.16,
    type: "triangle",
    volume: 0.12,
    gap: 0.06,
  },
  uiClick: { frequencies: [620], duration: 0.055, type: "sine", volume: 0.05 },
  disappearingBlock: {
    frequencies: [420, 210],
    duration: 0.14,
    type: "square",
    volume: 0.07,
    gap: 0.045,
  },
  message: { frequencies: [440], duration: 0.08, type: "sine", volume: 0.045 },
  attack: { frequencies: [310, 220], duration: 0.08, type: "sawtooth", volume: 0.065, gap: 0.02 },
  blaster: { frequencies: [740, 520], duration: 0.07, type: "square", volume: 0.06, gap: 0.018 },
  hit: { frequencies: [180, 120], duration: 0.11, type: "square", volume: 0.08, gap: 0.025 },
};

const MUSIC_PATTERNS: Record<Exclude<AmbientMusic, "none">, number[]> = {
  calm: [261.63, 329.63, 392, 329.63],
  adventure: [293.66, 369.99, 440, 493.88],
  dark: [196, 233.08, 261.63, 233.08],
  neon: [329.63, 493.88, 659.25, 739.99],
};

function getCueThrottleMs(cue: AudioCue): number {
  if (cue === "damage" || cue === "death") {
    return 500;
  }

  if (cue === "button" || cue === "door") {
    return 180;
  }

  if (cue === "attack" || cue === "blaster" || cue === "hit") {
    return 90;
  }

  return 80;
}

function readLocalAudioPreferences(): LocalAudioPreferences {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(LOCAL_SETTINGS_KEY) ?? "{}");

    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    const record = parsed as Record<string, unknown>;
    return {
      masterVolume: typeof record.masterVolume === "number" ? record.masterVolume : undefined,
      muted: typeof record.muted === "boolean" ? record.muted : undefined,
    };
  } catch {
    return {};
  }
}

function writeLocalAudioPreferences(preferences: LocalAudioPreferences): void {
  try {
    const current: unknown = JSON.parse(window.localStorage.getItem(LOCAL_SETTINGS_KEY) ?? "{}");
    const record =
      typeof current === "object" && current !== null ? (current as Record<string, unknown>) : {};
    window.localStorage.setItem(
      LOCAL_SETTINGS_KEY,
      JSON.stringify({
        ...record,
        masterVolume: preferences.masterVolume,
        muted: preferences.muted,
      })
    );
  } catch {
    window.localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(preferences));
  }
}
