import type { FeedbackCue, FeedbackSystem } from "../FeedbackSystem";
import type { Vector3 } from "../../shared/types/ObjectSchema";

export type FeedbackSpawn = {
  cue: FeedbackCue;
  position?: Vector3;
  label?: string;
};

export type MockFeedbackSystem = FeedbackSystem & {
  spawns: FeedbackSpawn[];
};

export function createMockFeedbackSystem(): MockFeedbackSystem {
  const spawns: FeedbackSpawn[] = [];
  const mock = {
    spawns,
    spawn: (cue: FeedbackCue, position?: Vector3, label?: string) => {
      spawns.push({ cue, position, label });
    },
  };

  return mock as unknown as MockFeedbackSystem;
}
