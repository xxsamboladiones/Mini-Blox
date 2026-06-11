import type { RuntimeHud, TycoonHudStatus } from "../RuntimeHud";

export type HudMessage = {
  text: string;
  durationMs: number;
};

export type MockRuntimeHud = RuntimeHud & {
  messages: HudMessage[];
  tycoonStatuses: Array<TycoonHudStatus | null>;
  getLatestTycoonStatus: () => TycoonHudStatus | null;
};

export function createMockHud(): MockRuntimeHud {
  const messages: HudMessage[] = [];
  const tycoonStatuses: Array<TycoonHudStatus | null> = [];

  const mock = {
    messages,
    tycoonStatuses,
    getLatestTycoonStatus: () => tycoonStatuses.at(-1) ?? null,
    showMessage: (text: string, durationMs = 1800) => {
      messages.push({ text, durationMs });
    },
    setTycoonStatus: (status: TycoonHudStatus | null) => {
      tycoonStatuses.push(status);
    },
  };

  return mock as unknown as MockRuntimeHud;
}
