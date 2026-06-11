export const RUNTIME_INTERACTION_PRIORITIES = {
  tycoon: 100,
  npc: 70,
  pickup: 60,
  doorButton: 50,
  default: 0,
} as const;

export type RuntimeSystemRegistrationOptions = {
  interactionPriority?: number;
  worldEventPriority?: number;
};
