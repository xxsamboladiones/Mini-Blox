import type { AudioCue, AudioSystem } from "../AudioSystem";

export type MockAudioSystem = AudioSystem & {
  playedCues: AudioCue[];
};

export function createMockAudioSystem(): MockAudioSystem {
  const playedCues: AudioCue[] = [];
  const mock = {
    playedCues,
    play: (cue: AudioCue) => {
      playedCues.push(cue);
    },
  };

  return mock as unknown as MockAudioSystem;
}
