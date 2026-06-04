import type {
  ChatMessage,
  EnemyNetState,
  EnemyPositionUpdate,
  PlayerAttackPayload,
  PlayerCombatState,
  RoomPlayer,
  SharedWorldState,
  Vector3,
  WorldEvent,
} from "./types.js";
import type { RoomMapIndex } from "./RoomMapIndex.js";
import { createEmptyRoomMapIndex } from "./RoomMapIndex.js";
import { createId } from "../utils/createId.js";

const MAX_HEALTH = 100;
const MAX_WORLD_EVENT_ID_LENGTH = 160;
const MAX_CHAT_MESSAGES = 50;
const MAX_CHAT_TEXT_LENGTH = 200;
const CHAT_RATE_LIMIT_MS = 1000;
const MAX_DAMAGE_REPORT = 60;
const DAMAGE_REPORT_RATE_LIMIT_MS = 180;
const MAX_ENEMY_HIT_DAMAGE = 100;
const MAX_PLAYER_ATTACK_DAMAGE = 35;
const MAX_PLAYER_ATTACK_RANGE = 4;
const PLAYER_ATTACK_COOLDOWN_MS = 380;
const MAX_PLAYER_SPEED_UNITS_PER_SECOND = 45;
const MAX_ABSOLUTE_POSITION = 10000;

type RemovePlayerResult = {
  removed: boolean;
  hostChanged: boolean;
  previousHostPlayerId: string | null;
};

type DamageResult = {
  targetPlayer: RoomPlayer;
  combatState: PlayerCombatState;
  damage: number;
  defeated: boolean;
  attackerPlayerId?: string;
};

type WeaponRule = {
  damage: number;
  range: number;
  cooldownMs: number;
};

const WEAPON_RULES: Record<string, WeaponRule> = {
  basic_sword: {
    damage: MAX_PLAYER_ATTACK_DAMAGE,
    range: MAX_PLAYER_ATTACK_RANGE,
    cooldownMs: PLAYER_ATTACK_COOLDOWN_MS,
  },
};

export class GameRoom {
  private players = new Map<string, RoomPlayer>();
  private readonly playerCombatStates = new Map<string, PlayerCombatState>();
  private readonly enemyStates = new Map<string, EnemyNetState>();
  private readonly chatMessages: ChatMessage[] = [];
  private readonly lastChatAtByPlayerId = new Map<string, number>();
  private readonly lastDamageReportAtByPlayerId = new Map<string, number>();
  private readonly lastAttackAtByPlayerId = new Map<string, number>();
  private readonly sharedState: SharedWorldState = {
    openedDoorIds: [],
    activatedButtonIds: [],
    collectedCoinObjectIds: [],
    collectedItemObjectIds: [],
  };
  private readonly maxPlayers: number;
  public readonly createdAt: string;
  public lastActivityAt: string;
  public hostPlayerId: string | null = null;

  constructor(
    public readonly roomId: string,
    public readonly mapId: string,
    public readonly onlineMapId: string,
    maxPlayers: number = 8,
    public readonly mapIndex: RoomMapIndex = createEmptyRoomMapIndex(onlineMapId)
  ) {
    this.maxPlayers = maxPlayers;
    const now = new Date().toISOString();
    this.createdAt = now;
    this.lastActivityAt = now;

    for (const [objectId, enemy] of Object.entries(mapIndex.enemyInitialStates)) {
      this.enemyStates.set(objectId, cloneEnemyState(enemy));
    }
  }

  addPlayer(clientId: string, playerName: string): RoomPlayer | null {
    if (this.players.size >= this.maxPlayers) {
      return null;
    }

    const playerId = createId("player");
    const now = new Date().toISOString();
    const teamId = this.assignTeam();
    const spawnPoint = this.getRespawnPoint(teamId);
    const player: RoomPlayer = {
      id: playerId,
      clientId,
      name: normalizePlayerName(playerName),
      teamId,
      position: spawnPoint,
      rotationY: 0,
      health: MAX_HEALTH,
      maxHealth: MAX_HEALTH,
      equippedWeaponId: null,
      score: 0,
      isAlive: true,
      joinedAt: now,
      lastUpdateAt: now,
    };

    this.players.set(playerId, player);
    this.playerCombatStates.set(playerId, {
      playerId,
      health: MAX_HEALTH,
      maxHealth: MAX_HEALTH,
      alive: true,
      lastRespawnAt: Date.now(),
    });

    if (!this.hostPlayerId) {
      this.hostPlayerId = playerId;
    }

    this.updateActivity();
    return player;
  }

  removePlayer(playerId: string): RemovePlayerResult {
    const previousHostPlayerId = this.hostPlayerId;
    const removed = this.players.delete(playerId);

    if (!removed) {
      return { removed: false, hostChanged: false, previousHostPlayerId };
    }

    this.playerCombatStates.delete(playerId);
    this.lastChatAtByPlayerId.delete(playerId);
    this.lastDamageReportAtByPlayerId.delete(playerId);
    this.lastAttackAtByPlayerId.delete(playerId);

    if (this.hostPlayerId === playerId) {
      this.hostPlayerId = this.players.keys().next().value ?? null;
    }

    this.updateActivity();
    return {
      removed: true,
      hostChanged: previousHostPlayerId !== this.hostPlayerId,
      previousHostPlayerId,
    };
  }

  getPlayer(playerId: string): RoomPlayer | undefined {
    return this.players.get(playerId);
  }

  getPlayerByClientId(clientId: string): RoomPlayer | undefined {
    return Array.from(this.players.values()).find((p) => p.clientId === clientId);
  }

  updatePlayerState(
    playerId: string,
    position: Vector3,
    rotationY: number,
    health: number,
    equippedWeaponId: string | null,
    score: number
  ): RoomPlayer | null {
    const player = this.players.get(playerId);
    const combatState = this.playerCombatStates.get(playerId);
    if (!player || !combatState) {
      return null;
    }

    if (!Number.isFinite(rotationY)) {
      return null;
    }

    const now = Date.now();
    const previousUpdateAt = new Date(player.lastUpdateAt).getTime();
    const elapsedSeconds = Math.max(0.05, (now - previousUpdateAt) / 1000);

    if (
      this.isValidPosition(position) &&
      this.isMovementPlausible(player, position, elapsedSeconds, combatState)
    ) {
      player.position = cloneVector(position);
    }

    player.rotationY = rotationY;
    player.equippedWeaponId = normalizeWeaponId(equippedWeaponId);

    if (this.isValidHealth(health)) {
      const clampedHealth = clamp(health, 0, player.maxHealth);

      if (clampedHealth < combatState.health) {
        this.applyDamageToPlayer(player, combatState.health - clampedHealth);
      }
    }

    if (Number.isFinite(score) && score <= player.score) {
      player.score = Math.max(0, Math.floor(score));
    }

    this.syncPlayerFromCombatState(player, combatState);
    player.lastUpdateAt = new Date(now).toISOString();
    this.updateActivity();
    return player;
  }

  getAllPlayers(): RoomPlayer[] {
    return Array.from(this.players.values()).map(clonePlayer);
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getSharedState(): SharedWorldState {
    return {
      openedDoorIds: [...this.sharedState.openedDoorIds],
      activatedButtonIds: [...this.sharedState.activatedButtonIds],
      collectedCoinObjectIds: [...this.sharedState.collectedCoinObjectIds],
      collectedItemObjectIds: [...this.sharedState.collectedItemObjectIds],
    };
  }

  getEnemyStates(): Record<string, EnemyNetState> {
    return mapToRecord(this.enemyStates, cloneEnemyState);
  }

  getPlayerCombatStates(): Record<string, PlayerCombatState> {
    return mapToRecord(this.playerCombatStates, cloneCombatState);
  }

  getChatMessages(): ChatMessage[] {
    return this.chatMessages.map(cloneChatMessage);
  }

  applyWorldEvent(event: WorldEvent): WorldEvent | null {
    const normalized = this.normalizeWorldEvent(event);

    if (!normalized) {
      return null;
    }

    if (normalized.type === "doorOpened") {
      addUnique(this.sharedState.openedDoorIds, normalized.doorId);
    } else if (normalized.type === "doorClosed") {
      removeValue(this.sharedState.openedDoorIds, normalized.doorId);
    } else if (normalized.type === "buttonActivated") {
      addUnique(this.sharedState.activatedButtonIds, normalized.objectId);
    } else if (normalized.type === "coinCollected") {
      addUnique(this.sharedState.collectedCoinObjectIds, normalized.objectId);
    } else if (normalized.type === "itemCollected") {
      addUnique(this.sharedState.collectedItemObjectIds, normalized.objectId);
    }

    this.updateActivity();
    return normalized;
  }

  applyEnemyHit(
    playerId: string,
    enemyObjectId: string,
    damage: number
  ): { enemy: EnemyNetState; defeated: boolean; damage: number } | null {
    if (!this.players.has(playerId) || typeof enemyObjectId !== "string") {
      return null;
    }

    const enemy = this.enemyStates.get(enemyObjectId);
    if (!enemy || !enemy.alive || enemy.health <= 0) {
      return null;
    }

    if (!Number.isFinite(damage) || damage <= 0) {
      return null;
    }

    const appliedDamage = clamp(damage, 0, MAX_ENEMY_HIT_DAMAGE);
    enemy.health = Math.max(0, enemy.health - appliedDamage);
    enemy.updatedAt = Date.now();

    if (enemy.health <= 0) {
      enemy.health = 0;
      enemy.alive = false;
      enemy.state = "dead";
    }

    this.updateActivity();
    return {
      enemy: cloneEnemyState(enemy),
      defeated: !enemy.alive,
      damage: appliedDamage,
    };
  }

  updateEnemyPositions(playerId: string, updates: EnemyPositionUpdate[]): EnemyNetState[] {
    if (playerId !== this.hostPlayerId || !Array.isArray(updates)) {
      return [];
    }

    const changed: EnemyNetState[] = [];
    const now = Date.now();

    for (const update of updates.slice(0, 64)) {
      const enemy = this.enemyStates.get(update.objectId);

      if (!enemy || !enemy.alive || !this.isValidPosition(update.position)) {
        continue;
      }

      if (!Number.isFinite(update.rotationY)) {
        continue;
      }

      enemy.position = cloneVector(update.position);
      enemy.rotationY = update.rotationY;
      enemy.targetPlayerId = this.players.has(update.targetPlayerId ?? "")
        ? update.targetPlayerId
        : undefined;
      enemy.state = normalizeEnemyState(update.state, enemy.state);
      enemy.updatedAt = now;
      changed.push(cloneEnemyState(enemy));
    }

    if (changed.length > 0) {
      this.updateActivity();
    }

    return changed;
  }

  applyPlayerAttack(attackerPlayerId: string, payload: PlayerAttackPayload): DamageResult | null {
    const attacker = this.players.get(attackerPlayerId);
    if (!attacker || !this.mapIndex.multiplayerSettings.pvpEnabled) {
      return null;
    }

    const weaponId = normalizeWeaponId(payload.weaponId);
    const weaponRule = weaponId ? WEAPON_RULES[weaponId] : null;
    if (!weaponRule || !payload.targetPlayerId) {
      return null;
    }

    const target = this.players.get(payload.targetPlayerId);
    const targetCombat = this.playerCombatStates.get(payload.targetPlayerId);
    if (!target || !targetCombat || target.id === attacker.id || !targetCombat.alive) {
      return null;
    }

    if (!this.canDamageTarget(attacker, target)) {
      return null;
    }

    const now = Date.now();
    const lastAttackAt = this.lastAttackAtByPlayerId.get(attackerPlayerId) ?? 0;
    if (now - lastAttackAt < weaponRule.cooldownMs) {
      return null;
    }

    if (
      !this.isValidPosition(payload.origin) ||
      !this.isValidDirection(payload.direction) ||
      !Number.isFinite(payload.range) ||
      !Number.isFinite(payload.damage)
    ) {
      return null;
    }

    const range = clamp(payload.range, 0, weaponRule.range);
    const damage = clamp(payload.damage, 0, weaponRule.damage);
    if (range <= 0 || damage <= 0) {
      return null;
    }

    const distance = distance3D(attacker.position, target.position);
    if (distance > range + 1.25) {
      return null;
    }

    const horizontalDistance = distance2D(attacker.position, target.position);
    if (
      horizontalDistance > 0.35 &&
      !isTargetInAttackCone(attacker.position, target.position, payload.direction)
    ) {
      return null;
    }

    this.lastAttackAtByPlayerId.set(attackerPlayerId, now);
    const result = this.applyDamageToPlayer(target, damage, attacker.id);

    if (result?.defeated) {
      attacker.score += 1;
    }

    return result;
  }

  applyReportedPlayerDamage(
    reporterPlayerId: string,
    targetPlayerId: string | undefined,
    damage: number
  ): DamageResult | null {
    const targetId = targetPlayerId ?? reporterPlayerId;

    if (targetId !== reporterPlayerId && reporterPlayerId !== this.hostPlayerId) {
      return null;
    }

    const target = this.players.get(targetId);
    if (!target) {
      return null;
    }

    const now = Date.now();
    const lastDamageAt = this.lastDamageReportAtByPlayerId.get(targetId) ?? 0;
    if (now - lastDamageAt < DAMAGE_REPORT_RATE_LIMIT_MS) {
      return null;
    }

    if (!Number.isFinite(damage) || damage <= 0) {
      return null;
    }

    this.lastDamageReportAtByPlayerId.set(targetId, now);
    return this.applyDamageToPlayer(target, clamp(damage, 0, MAX_DAMAGE_REPORT));
  }

  respawnPlayer(playerId: string): { player: RoomPlayer; combatState: PlayerCombatState } | null {
    const player = this.players.get(playerId);
    const combatState = this.playerCombatStates.get(playerId);
    if (!player || !combatState) {
      return null;
    }

    const position = this.getRespawnPoint(player.teamId);
    player.position = position;
    player.health = MAX_HEALTH;
    player.maxHealth = MAX_HEALTH;
    player.isAlive = true;
    player.lastUpdateAt = new Date().toISOString();

    combatState.health = MAX_HEALTH;
    combatState.maxHealth = MAX_HEALTH;
    combatState.alive = true;
    combatState.lastRespawnAt = Date.now();

    this.updateActivity();
    return {
      player: clonePlayer(player),
      combatState: cloneCombatState(combatState),
    };
  }

  getRespawnDelayMs(): number {
    const seconds = this.mapIndex.gameModeSettings?.respawnDelay;
    const safeSeconds = typeof seconds === "number" && Number.isFinite(seconds) ? seconds : 2;
    return Math.max(0.2, safeSeconds) * 1000;
  }

  addPlayerChatMessage(playerId: string, text: string): ChatMessage | null {
    const player = this.players.get(playerId);
    if (!player || typeof text !== "string") {
      return null;
    }

    const now = Date.now();
    const lastChatAt = this.lastChatAtByPlayerId.get(playerId) ?? 0;
    if (now - lastChatAt < CHAT_RATE_LIMIT_MS) {
      return null;
    }

    const normalizedText = normalizeChatText(text);
    if (!normalizedText) {
      return null;
    }

    this.lastChatAtByPlayerId.set(playerId, now);
    return this.pushChatMessage({
      id: createId("chat"),
      playerId,
      playerName: player.name,
      text: normalizedText,
      createdAt: now,
      type: "player",
    });
  }

  addSystemMessage(text: string): ChatMessage {
    return this.pushChatMessage({
      id: createId("chat"),
      playerId: "system",
      playerName: "Sistema",
      text: normalizeChatText(text) ?? "Evento da sala",
      createdAt: Date.now(),
      type: "system",
    });
  }

  updateActivity(): void {
    this.lastActivityAt = new Date().toISOString();
  }

  private applyDamageToPlayer(
    targetPlayer: RoomPlayer,
    amount: number,
    attackerPlayerId?: string
  ): DamageResult | null {
    const combatState = this.playerCombatStates.get(targetPlayer.id);
    if (!combatState || !combatState.alive) {
      return null;
    }

    const damage = clamp(amount, 0, combatState.health);
    if (damage <= 0) {
      return null;
    }

    combatState.health = Math.max(0, combatState.health - damage);
    combatState.alive = combatState.health > 0;
    combatState.lastDamageAt = Date.now();
    this.syncPlayerFromCombatState(targetPlayer, combatState);
    this.updateActivity();

    return {
      targetPlayer: clonePlayer(targetPlayer),
      combatState: cloneCombatState(combatState),
      damage,
      defeated: !combatState.alive,
      attackerPlayerId,
    };
  }

  private syncPlayerFromCombatState(player: RoomPlayer, combatState: PlayerCombatState): void {
    player.health = combatState.health;
    player.maxHealth = combatState.maxHealth;
    player.isAlive = combatState.alive;
  }

  private canDamageTarget(attacker: RoomPlayer, target: RoomPlayer): boolean {
    if (attacker.teamId && target.teamId && attacker.teamId === target.teamId) {
      return this.mapIndex.multiplayerSettings.friendlyFire;
    }

    return true;
  }

  private assignTeam(): string | null {
    const settings = this.mapIndex.gameModeSettings;
    const teamIds = [...this.mapIndex.teamIds];

    if (!settings?.teamsEnabled || teamIds.length === 0) {
      return null;
    }

    const counts = new Map(teamIds.map((teamId) => [teamId, 0]));
    for (const player of this.players.values()) {
      if (player.teamId) {
        counts.set(player.teamId, (counts.get(player.teamId) ?? 0) + 1);
      }
    }

    return teamIds.sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))[0] ?? null;
  }

  private getRespawnPoint(teamId: string | null): Vector3 {
    if (teamId) {
      const teamSpawn = this.mapIndex.teamSpawns.get(teamId);
      if (teamSpawn) {
        return cloneVector(teamSpawn);
      }
    }

    return cloneVector(this.mapIndex.spawnPoint);
  }

  private pushChatMessage(message: ChatMessage): ChatMessage {
    this.chatMessages.push(message);

    while (this.chatMessages.length > MAX_CHAT_MESSAGES) {
      this.chatMessages.shift();
    }

    this.updateActivity();
    return cloneChatMessage(message);
  }

  private isValidPosition(position: Vector3): boolean {
    return (
      typeof position.x === "number" &&
      typeof position.y === "number" &&
      typeof position.z === "number" &&
      Number.isFinite(position.x) &&
      Number.isFinite(position.y) &&
      Number.isFinite(position.z) &&
      Math.abs(position.x) <= MAX_ABSOLUTE_POSITION &&
      Math.abs(position.y) <= MAX_ABSOLUTE_POSITION &&
      Math.abs(position.z) <= MAX_ABSOLUTE_POSITION
    );
  }

  private isMovementPlausible(
    player: RoomPlayer,
    position: Vector3,
    elapsedSeconds: number,
    combatState: PlayerCombatState
  ): boolean {
    const lastRespawnAt = combatState.lastRespawnAt ?? 0;
    if (Date.now() - lastRespawnAt < 2500) {
      return true;
    }

    const maxDistance = Math.max(14, elapsedSeconds * MAX_PLAYER_SPEED_UNITS_PER_SECOND + 6);
    return distance3D(player.position, position) <= maxDistance;
  }

  private isValidDirection(direction: Vector3): boolean {
    if (!this.isValidPosition(direction)) {
      return false;
    }

    const length = Math.hypot(direction.x, direction.y, direction.z);
    return length > 0.01 && length <= 2;
  }

  private isValidHealth(health: number): boolean {
    return typeof health === "number" && Number.isFinite(health);
  }

  private normalizeWorldEvent(event: WorldEvent): WorldEvent | null {
    if (!event || typeof event.type !== "string") {
      return null;
    }

    const objectId = normalizeWorldEventId(event.objectId);
    const doorId = normalizeWorldEventId(event.doorId);

    if (event.type === "doorOpened" || event.type === "doorClosed") {
      if (!doorId || !this.mapIndex.doorIds.has(doorId)) {
        return null;
      }

      if (objectId && !this.mapIndex.objectIds.has(objectId)) {
        return null;
      }

      return objectId ? { type: event.type, doorId, objectId } : { type: event.type, doorId };
    }

    if (event.type === "buttonActivated") {
      if (!objectId || !this.mapIndex.buttonObjectIds.has(objectId)) {
        return null;
      }

      if (doorId && !this.mapIndex.doorIds.has(doorId)) {
        return null;
      }

      return doorId ? { type: event.type, objectId, doorId } : { type: event.type, objectId };
    }

    if (event.type === "coinCollected") {
      if (!objectId || !this.mapIndex.coinObjectIds.has(objectId)) {
        return null;
      }

      return { type: event.type, objectId };
    }

    if (event.type === "itemCollected") {
      if (!objectId || !this.mapIndex.itemObjectIds.has(objectId)) {
        return null;
      }

      return { type: event.type, objectId };
    }

    return null;
  }
}

function normalizeWorldEventId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const id = value.trim();
  if (id.length === 0 || id.length > MAX_WORLD_EVENT_ID_LENGTH) {
    return null;
  }

  return id;
}

function normalizePlayerName(value: string): string {
  const name = typeof value === "string" ? value.trim() : "";
  return (name || "Jogador").slice(0, 40);
}

function normalizeChatText(value: string): string | null {
  const text = value.trim().replace(/\s+/g, " ").slice(0, MAX_CHAT_TEXT_LENGTH);
  return text.length > 0 ? text : null;
}

function normalizeWeaponId(value: string | null | undefined): string | null {
  if (value === "weapon_basic" || value === "sword" || value === "basic_sword") {
    return "basic_sword";
  }

  return null;
}

function normalizeEnemyState(
  value: EnemyPositionUpdate["state"],
  fallback: EnemyNetState["state"]
): EnemyNetState["state"] {
  if (value === "idle" || value === "patrol" || value === "chase") {
    return value;
  }

  return fallback === "dead" ? "idle" : fallback;
}

function cloneVector(position: Vector3): Vector3 {
  return { x: position.x, y: position.y, z: position.z };
}

function clonePlayer(player: RoomPlayer): RoomPlayer {
  return {
    ...player,
    position: cloneVector(player.position),
  };
}

function cloneEnemyState(enemy: EnemyNetState): EnemyNetState {
  return {
    ...enemy,
    position: cloneVector(enemy.position),
  };
}

function cloneCombatState(state: PlayerCombatState): PlayerCombatState {
  return { ...state };
}

function cloneChatMessage(message: ChatMessage): ChatMessage {
  return { ...message };
}

function mapToRecord<T, U>(map: Map<string, T>, clone: (value: T) => U): Record<string, U> {
  const record: Record<string, U> = {};

  for (const [key, value] of map.entries()) {
    record[key] = clone(value);
  }

  return record;
}

function addUnique(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function removeValue(values: string[], value: string): void {
  const index = values.indexOf(value);

  if (index >= 0) {
    values.splice(index, 1);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance2D(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distance3D(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function isTargetInAttackCone(origin: Vector3, target: Vector3, direction: Vector3): boolean {
  const toTarget = {
    x: target.x - origin.x,
    y: 0,
    z: target.z - origin.z,
  };
  const toTargetLength = Math.hypot(toTarget.x, toTarget.z);
  const directionLength = Math.hypot(direction.x, direction.z);

  if (toTargetLength <= 0.001 || directionLength <= 0.001) {
    return true;
  }

  const dot =
    (toTarget.x / toTargetLength) * (direction.x / directionLength) +
    (toTarget.z / toTargetLength) * (direction.z / directionLength);
  return dot >= 0.08;
}
