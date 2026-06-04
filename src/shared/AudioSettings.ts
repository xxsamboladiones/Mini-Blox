import type { AmbientMusic, AudioSettings } from "./types/MapSchema";

export const DEFAULT_AUDIO_SETTINGS: Required<AudioSettings> = {
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicVolume: 0.35,
  muted: false,
  ambientMusic: "none",
};

export const AMBIENT_MUSIC_LABELS: Record<AmbientMusic, string> = {
  none: "Nenhuma",
  calm: "Calma",
  adventure: "Aventura",
  dark: "Dark",
  neon: "Neon",
};

export function resolveAudioSettings(settings?: AudioSettings): Required<AudioSettings> {
  return {
    ...DEFAULT_AUDIO_SETTINGS,
    ...settings,
    masterVolume: clampVolume(settings?.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume),
    sfxVolume: clampVolume(settings?.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume),
    musicVolume: clampVolume(settings?.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume),
    muted: settings?.muted ?? DEFAULT_AUDIO_SETTINGS.muted,
    ambientMusic: getAmbientMusic(settings?.ambientMusic),
  };
}

function getAmbientMusic(value: unknown): AmbientMusic {
  if (value === "calm" || value === "adventure" || value === "dark" || value === "neon") {
    return value;
  }

  return "none";
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
