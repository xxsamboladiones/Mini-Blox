import type { WorldEvent } from "../../../shared/types/MultiplayerSchema";

export type RuntimeWorldEventHandler = (event: WorldEvent) => boolean;
