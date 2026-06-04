export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type ColliderShape = "box" | "sphere" | "capsule" | "mesh" | "none";

export type ColliderSchema = {
  shape: ColliderShape;
  isTrigger?: boolean;
  size?: Vector3;
  radius?: number;
  height?: number;
};

export type MapObjectProperties = Record<string, unknown> & {
  color?: string;
  collision?: boolean;
  material?: string;
  opacity?: number;
  emissive?: string;
  activatedColor?: string;
  mode?: "kill" | "damage";
  damage?: number;
  damagePerSecond?: number;
  checkpointId?: string;
  value?: number;
  coinValue?: number;
  doorId?: string;
  openOffset?: Vector3;
  startsOpen?: boolean;
  doorState?: "open" | "closed";
  targetDoorId?: string;
  oneTime?: boolean;
  buttonTargetId?: string;
  requiresAllCoins?: boolean;
  message?: string;
  dialog?: string;
  npcName?: string;
  dialogue?: string[];
  interactionRange?: number;
  showQuestHint?: boolean;
  enemyType?: string;
  health?: number;
  detectionRange?: number;
  attackRange?: number;
  attackCooldown?: number;
  behavior?: string;
  patrolOffset?: Vector3;
  itemPool?: string[];
  spawnItemType?: string;
  spawnMode?: string;
  respawnTime?: number;
  spawnOnStart?: boolean;
  maxSpawnedItems?: number;
  amount?: number;
  healAmount?: number;
  weaponId?: string;
  itemId?: string;
  sourceSpawnerId?: string;
  teamId?: string;
  pointId?: string;
  ownerTeamId?: string;
  captureTime?: number;
  scorePerSecond?: number;
  radius?: number;
  startOffset?: Vector3;
  endOffset?: Vector3;
  speed?: number;
  loop?: boolean;
  delayBeforeDisappear?: number;
  respawnDelay?: number;
  force?: number;
  teleporterId?: string;
  targetTeleporterId?: string;
  cooldown?: number;
  keyId?: string;
  label?: string;
  requiredKeyId?: string;
  text?: string;
  lightEnabled?: boolean;
  lightColor?: string;
  lightIntensity?: number;
  lightRange?: number;
};

export type MapObject = {
  id: string;
  type: string;
  name?: string;
  position: Vector3;
  rotation?: Vector3;
  scale?: Vector3;
  assetId?: string;
  materialId?: string;
  collider?: ColliderSchema;
  properties?: MapObjectProperties;
  scriptIds?: string[];
};

export type VisualTheme = "classic" | "grass" | "desert" | "neon" | "dark";

export type VisualSettings = {
  skyColor?: string;
  groundColor?: string;
  fogEnabled?: boolean;
  fogColor?: string;
  fogNear?: number;
  fogFar?: number;
  ambientLightIntensity?: number;
  sunLightIntensity?: number;
  theme?: VisualTheme;
};

export type AmbientMusic = "none" | "calm" | "adventure" | "dark" | "neon";

export type AudioSettings = {
  masterVolume?: number;
  sfxVolume?: number;
  musicVolume?: number;
  muted?: boolean;
  ambientMusic?: AmbientMusic;
};

export type GameplaySettings = {
  voidDeathEnabled?: boolean;
  voidDeathY?: number;
  requireObjectivesToFinish?: boolean;
};

export type MultiplayerSettings = {
  pvpEnabled?: boolean;
  friendlyFire?: boolean;
};

export type GameMode =
  | "freeplay"
  | "obby"
  | "coinCollect"
  | "combatArena"
  | "objectiveRun"
  | "teamBattle"
  | "capturePoint";

export type WinConditionType =
  | "none"
  | "finish"
  | "collectCoins"
  | "defeatEnemies"
  | "completeObjectives"
  | "score"
  | "capturePoint";

export type GameModeWinCondition = {
  type: WinConditionType;
  targetAmount?: number;
  requireAll?: boolean;
};

export type ScoringSettings = {
  coinScore?: number;
  enemyDefeatScore?: number;
  objectiveScore?: number;
  deathPenalty?: number;
};

export type GameModeSettings = {
  mode: GameMode;
  roundEnabled?: boolean;
  roundTimeLimit?: number;
  respawnDelay?: number;
  teamsEnabled?: boolean;
  requireObjectivesToFinish?: boolean;
  winCondition?: GameModeWinCondition;
  scoring?: ScoringSettings;
};

export type TeamDefinition = {
  id: string;
  name: string;
  color: string;
  spawnPoint?: Vector3;
};

export type ObjectiveType =
  | "collectCoins"
  | "reachObject"
  | "collectKey"
  | "activateButton"
  | "openDoor"
  | "defeatEnemies"
  | "customLogic";

export type MapObjective = {
  id: string;
  title: string;
  description?: string;
  type: ObjectiveType;
  targetObjectId?: string;
  targetKeyId?: string;
  targetDoorId?: string;
  targetAmount?: number;
  required?: boolean;
  visible?: boolean;
  completedMessage?: string;
};

export type LogicValue =
  | string
  | number
  | boolean
  | null
  | LogicValue[]
  | { [key: string]: LogicValue };

export type LogicTrigger =
  | { type: "onPlayerEnterObject"; objectId: string }
  | { type: "onButtonActivated"; objectId: string }
  | { type: "onCoinCollected"; objectId: string }
  | { type: "onKeyCollected"; keyId: string }
  | { type: "onEnemyDefeated"; objectId: string }
  | { type: "onAnyEnemyDefeated" }
  | { type: "onAllEnemiesDefeated" }
  | { type: "onPlayerDamaged" }
  | { type: "onItemCollected"; itemType: string }
  | { type: "onNpcInteracted"; objectId: string }
  | { type: "onObjectiveCompleted"; objectiveId: string }
  | { type: "onScoreReached"; amount: number }
  | { type: "onTeamScoreReached"; teamId: string; amount: number }
  | { type: "onCapturePointCaptured"; pointId: string; teamId?: string }
  | { type: "onGameModeWon" }
  | { type: "onMapStart" };

export type LogicCondition =
  | { type: "hasKey"; keyId: string }
  | { type: "coinsAtLeast"; amount: number }
  | { type: "doorIsOpen"; doorId: string }
  | { type: "enemyDefeated"; objectId: string }
  | { type: "enemiesDefeatedAtLeast"; amount: number }
  | { type: "hasWeapon"; weaponId: string }
  | { type: "healthBelow"; amount: number }
  | { type: "once" };

export type LogicAction =
  | { type: "showMessage"; message: string }
  | { type: "openDoor"; doorId: string }
  | { type: "closeDoor"; doorId: string }
  | { type: "teleportPlayer"; targetObjectId: string }
  | { type: "giveCoins"; amount: number }
  | { type: "setCheckpoint"; objectId: string }
  | { type: "finishMap" }
  | { type: "enableObject"; objectId: string }
  | { type: "disableObject"; objectId: string }
  | { type: "spawnEnemy"; objectId: string }
  | { type: "healPlayer"; amount: number }
  | { type: "damagePlayer"; amount: number }
  | { type: "giveWeapon"; weaponId: string }
  | { type: "completeObjective"; objectiveId: string }
  | { type: "showDialogue"; objectId: string; message: string }
  | { type: "addScore"; amount: number }
  | { type: "addTeamScore"; teamId: string; amount: number }
  | { type: "setTeam"; teamId: string }
  | { type: "endRound"; result: "win" | "lose" | "draw" };

export type LogicRule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: LogicTrigger;
  conditions: LogicCondition[];
  actions: LogicAction[];
};

export type MapAsset = {
  id: string;
  name: string;
  kind: "model" | "texture" | "audio";
  mimeType?: string;
  dataUrl?: string;
  url?: string;
};

export type GameMap = {
  version?: number;
  id: string;
  name: string;
  authorId: string;
  description?: string;
  creatorName?: string;
  spawnPoint: Vector3;
  objects: MapObject[];
  objectives?: MapObjective[];
  gameModeSettings?: GameModeSettings;
  teams?: TeamDefinition[];
  logic?: LogicRule[];
  logicDebug?: boolean;
  visualSettings?: VisualSettings;
  audioSettings?: AudioSettings;
  gameplaySettings?: GameplaySettings;
  multiplayerSettings?: MultiplayerSettings;
  assets?: MapAsset[];
  createdAt?: string;
  updatedAt?: string;
  thumbnail?: string;
  tags?: string[];
  isPublished?: boolean;
  publishedAt?: string;
};

export type OnlineMapSummary = {
  id: string;
  name: string;
  description: string;
  creatorName: string;
  thumbnail: string | null;
  tags: string[];
  theme: string;
  objectCount: number;
  mode: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  playCount: number;
  likeCount: number;
};

export type OnlineMapEntry = {
  id: string;
  ownerClientId: string;
  map: GameMap;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  playCount: number;
  likedBy: string[];
};

export type OnlineMapStorageData = {
  maps: OnlineMapEntry[];
};

export type PublishMapRequest = {
  map: GameMap;
  creatorName: string;
  clientId: string;
};

export type UpdateMapRequest = {
  map: GameMap;
  clientId: string;
};

export type LikeMapRequest = {
  clientId: string;
};

export type HealthResponse = {
  ok: boolean;
  service: string;
  version: string;
};

export type PublishMapResponse = {
  ok: true;
  onlineId: string;
  map: OnlineMapSummary;
};

export type ErrorResponse = {
  ok: false;
  error: string;
};

export type LikeMapResponse = {
  liked: boolean;
  likeCount: number;
};
