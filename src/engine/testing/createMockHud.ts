import type {
  GameModeHudStatus,
  GameModeSummary,
  HudInventoryItem,
  HudObjectiveState,
  RuntimeHud,
  RuntimeWeaponHudInfo,
  TycoonHudStatus,
  VictoryActions,
} from "../RuntimeHud";

export type HudMessage = {
  text: string;
  durationMs: number;
};

export type MockRuntimeHud = RuntimeHud & {
  messages: HudMessage[];
  coins: Array<{ count: number; total?: number }>;
  health: Array<{ current: number; max: number }>;
  weapons: Array<RuntimeWeaponHudInfo | string | null>;
  inventories: HudInventoryItem[][];
  objectives: HudObjectiveState[][];
  gameModeStatuses: Array<GameModeHudStatus | null>;
  tycoonStatuses: Array<TycoonHudStatus | null>;
  victories: Array<{ message: string; coinCount: number; summary?: GameModeSummary }>;
  defeats: Array<{ message: string; summary?: GameModeSummary; durationMs: number }>;
  getLatestTycoonStatus: () => TycoonHudStatus | null;
};

export function createMockHud(): MockRuntimeHud {
  const messages: HudMessage[] = [];
  const coins: Array<{ count: number; total?: number }> = [];
  const health: Array<{ current: number; max: number }> = [];
  const weapons: Array<RuntimeWeaponHudInfo | string | null> = [];
  const inventories: HudInventoryItem[][] = [];
  const objectives: HudObjectiveState[][] = [];
  const gameModeStatuses: Array<GameModeHudStatus | null> = [];
  const tycoonStatuses: Array<TycoonHudStatus | null> = [];
  const victories: Array<{ message: string; coinCount: number; summary?: GameModeSummary }> = [];
  const defeats: Array<{ message: string; summary?: GameModeSummary; durationMs: number }> = [];

  const mock = {
    messages,
    coins,
    health,
    weapons,
    inventories,
    objectives,
    gameModeStatuses,
    tycoonStatuses,
    victories,
    defeats,
    getLatestTycoonStatus: () => tycoonStatuses.at(-1) ?? null,
    showMessage: (text: string, durationMs = 1800) => {
      messages.push({ text, durationMs });
    },
    setCoins: (count: number, total?: number) => {
      coins.push({ count, total });
    },
    setHealth: (current: number, max: number) => {
      health.push({ current, max });
    },
    setWeapon: (weapon: RuntimeWeaponHudInfo | string | null) => {
      weapons.push(weapon);
    },
    setInventory: (items: HudInventoryItem[]) => {
      inventories.push(structuredClone(items));
    },
    setObjectives: (items: HudObjectiveState[]) => {
      objectives.push(structuredClone(items));
    },
    setGameModeStatus: (status: GameModeHudStatus | null) => {
      gameModeStatuses.push(status);
    },
    setTycoonStatus: (status: TycoonHudStatus | null) => {
      tycoonStatuses.push(status);
    },
    showVictory: (
      message: string,
      coinCount: number,
      _actions: VictoryActions,
      summary?: GameModeSummary
    ) => {
      victories.push({ message, coinCount, summary });
    },
    showDefeat: (
      message: string,
      _actions?: Partial<VictoryActions>,
      summary?: GameModeSummary,
      durationMs = 2600
    ) => {
      defeats.push({ message, summary, durationMs });
    },
  };

  return mock as unknown as MockRuntimeHud;
}
