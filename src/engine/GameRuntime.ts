import * as THREE from "three";
import { AssetLoader } from "./AssetLoader";
import { AudioSystem } from "./AudioSystem";
import { createMapObject3D, disposeObject3D, stampMapObject3D } from "./ObjectFactory";
import { FeedbackSystem } from "./FeedbackSystem";
import { PlayerController } from "./PlayerController";
import { PhysicsSystem } from "./PhysicsSystem";
import { RuntimeHud, type RuntimeSessionHudStatus } from "./RuntimeHud";
import { RuntimeMechanics } from "./RuntimeMechanics";
import {
  canSyncWorldState,
  canUseMultiplayerMechanics,
  RuntimeNetworkController,
} from "./RuntimeNetworkController";
import { ThirdPersonCameraController } from "./ThirdPersonCameraController";
import { RemotePlayerView } from "./RemotePlayerView";
import { normalizeGameMapForRuntime } from "./normalizeGameMapForRuntime";
import { resolveVisualSettings } from "../shared/VisualSettings";
import type { GameMap } from "../shared/types/MapSchema";
import type { GameSessionAdapter } from "./session/GameSessionAdapter";
import type {
  ChatMessage,
  EnemyNetState,
  GameNetworkEvent,
  PlayerAttackVisualPayload,
  PlayerCombatState,
  PlayerNetState,
  SharedWorldState,
  SessionState,
  WorldEvent,
} from "../shared/types/MultiplayerSchema";
import type { Vector3 } from "../shared/types/ObjectSchema";

type GameRuntimeOptions = {
  onEditMap?: (map: GameMap) => void;
  onBackToMenu?: () => void;
  onMapCompleted?: (summary: { map: GameMap; coinsCollected: number }) => void;
  sessionAdapter?: GameSessionAdapter;
  isTestMode?: boolean;
};

export class GameRuntime {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly world = new THREE.Group();
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  private readonly clock = new THREE.Clock();
  private readonly assetLoader = new AssetLoader();
  private readonly physicsSystem = new PhysicsSystem();
  private readonly playerController: PlayerController;
  private readonly cameraController: ThirdPersonCameraController;
  private readonly hud: RuntimeHud;
  private readonly audioSystem = new AudioSystem();
  private readonly feedbackSystem: FeedbackSystem;
  private readonly objectViews = new Map<string, THREE.Object3D>();
  private readonly remotePlayers = new Map<string, RemotePlayerView>();
  private readonly remotePlayerStates = new Map<string, PlayerNetState>();
  private readonly resizeObserver: ResizeObserver;
  private ambientLight: THREE.HemisphereLight | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private mechanics: RuntimeMechanics | null = null;
  private animationFrame = 0;
  private activeMap: GameMap | null = null;
  private paused = false;
  private readonly sessionAdapter: GameSessionAdapter | undefined;
  private readonly network: RuntimeNetworkController;
  private networkSyncAccumulator = 0;
  private latestSharedWorldState: SharedWorldState | null = null;
  private chatMessages: ChatMessage[] = [];
  private sessionElapsedTime = 0;
  private sessionTimerRunning = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: GameRuntimeOptions = {}
  ) {
    this.sessionAdapter = options.sessionAdapter;
    this.network = new RuntimeNetworkController(this.sessionAdapter);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.className = "editor-canvas";
    this.container.replaceChildren(this.renderer.domElement);
    this.hud = new RuntimeHud(this.container);

    this.camera.position.set(7, 5, 8);
    this.playerController = new PlayerController(
      this.scene,
      this.camera,
      this.renderer.domElement,
      this.physicsSystem
    );
    this.playerController.setExternalCameraControl(true);
    this.feedbackSystem = new FeedbackSystem(this.world, this.container);
    this.cameraController = new ThirdPersonCameraController({
      camera: this.camera,
      container: this.container,
      domElement: this.renderer.domElement,
      getTargetPosition: () => {
        const position = this.playerController.getPosition();
        return new THREE.Vector3(position.x, position.y, position.z);
      },
      objectViews: this.objectViews,
      getInteractionHint: (objectId) => this.mechanics?.getInteractionHint(objectId) ?? null,
      interact: (objectId) => this.mechanics?.interactWithObject(objectId) ?? false,
      onPrimaryAction: () => this.mechanics?.attack(),
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    this.setupScene();
    this.resize();
    this.cameraController.start();
    window.addEventListener("keydown", this.handleRuntimeKeyDown);
    this.animate();
  }

  async loadMap(map: GameMap): Promise<void> {
    this.activeMap = normalizeGameMapForRuntime(map);
    this.latestSharedWorldState = null;
    this.paused = false;
    this.mechanics?.dispose();
    this.mechanics = null;
    this.clearWorld();
    this.clearRemotePlayers();
    this.remotePlayerStates.clear();
    this.objectViews.clear();
    this.feedbackSystem.clear();
    this.audioSystem.applySettings(this.activeMap.audioSettings);
    this.applyVisualSettings();
    this.hud.hidePause();
    this.hud.hideVictory();
    this.hud.hideDefeat();
    this.hud.setMapName(this.activeMap.name);
    this.sessionElapsedTime = 0;
    this.sessionTimerRunning = true;
    this.hud.setSessionTime(0);
    this.hud.setSessionStatus(this.getSessionHudStatus());
    this.hud.setActions({
      onContinue: () => {
        this.audioSystem.play("uiClick");
        this.resume();
      },
      onPause: () => {
        this.audioSystem.play("uiClick");
        this.pause();
      },
      onRestart: () => {
        this.audioSystem.play("uiClick");
        this.restart();
      },
      onEdit: () => {
        this.audioSystem.play("uiClick");
        this.editActiveMap();
      },
      onMenu: () => {
        this.audioSystem.play("uiClick");
        this.options.onBackToMenu?.();
      },
      onToggleMute: () => {
        this.audioSystem.toggleMuted();
        this.hud.setAudioMuted(this.audioSystem.isMuted());
      },
    });
    this.hud.setAudioMuted(this.audioSystem.isMuted());

    for (const mapObject of this.activeMap.objects) {
      const object3D = createMapObject3D(mapObject);

      if (mapObject.type === "model" && mapObject.assetId) {
        const asset = this.activeMap.assets?.find(
          (candidate) => candidate.id === mapObject.assetId
        );

        if (asset) {
          disposeObject3D(object3D);
          object3D.clear();
          const model = await this.assetLoader.loadModelInstance(asset);
          object3D.add(model);
          stampMapObject3D(object3D, mapObject.id);
        }
      }

      this.objectViews.set(mapObject.id, object3D);
      this.world.add(object3D);
    }

    this.physicsSystem.setCollidersFromObjects(this.activeMap, this.objectViews);
    this.playerController.start(this.activeMap.spawnPoint);
    this.cameraController.reset();
    this.mechanics = new RuntimeMechanics(
      this.activeMap,
      this.world,
      this.objectViews,
      this.playerController,
      this.hud,
      this.physicsSystem,
      this.audioSystem,
      this.feedbackSystem,
      {
        onRestart: () => this.restart(),
        onEdit: () => this.editActiveMap(),
        onMenu: () => this.options.onBackToMenu?.(),
        onWorldEvent: canSyncWorldState(this.sessionAdapter)
          ? (event) => this.network.sendWorldEvent(event)
          : undefined,
        multiplayer: canUseMultiplayerMechanics(this.sessionAdapter)
          ? {
              isHost: () => this.network.isHost(),
              getLocalPlayerId: () => this.network.getLocalPlayerId(),
              getRemotePlayers: () => [...this.remotePlayerStates.values()],
              onEnemyHit: (enemyObjectId, damage, weaponId) =>
                this.network.sendEnemyHit(enemyObjectId, damage, weaponId),
              onEnemyPositionUpdate: (enemies) => this.network.sendEnemyPositionUpdate(enemies),
              onPlayerAttack: (payload) => this.network.sendPlayerAttack(payload),
              onPlayerAttackVisual: (payload) => this.network.sendPlayerAttackVisual(payload),
              onPlayerDamageReport: (damage, source) =>
                this.network.sendPlayerDamageReport(damage, source),
              onPlayerHealRequest: (payload) => this.network.sendPlayerHealRequest(payload),
            }
          : undefined,
        onComplete: (coinsCollected) => {
          this.sessionTimerRunning = false;
          if (this.activeMap) {
            this.options.onMapCompleted?.({
              map: structuredClone(this.activeMap),
              coinsCollected,
            });
          }
        },
        getElapsedTime: () => this.sessionElapsedTime,
      }
    );

    if (this.sessionAdapter) {
      this.setupMultiplayer();
    }
  }

  private setupMultiplayer(): void {
    if (!this.sessionAdapter) return;

    this.sessionAdapter.onStateChange((state) => {
      this.handleRoomStateChange(state);
    });

    this.sessionAdapter.onNetworkEvent((event) => {
      this.handleNetworkEvent(event);
    });

    if (canSyncWorldState(this.sessionAdapter)) {
      this.sessionAdapter.onWorldState((state) => {
        this.handleWorldState(state);
      });

      this.sessionAdapter.onWorldEvent((event) => {
        this.handleWorldEvent(event);
      });
    }

    if (canUseMultiplayerMechanics(this.sessionAdapter)) {
      this.hud.setChatEnabled(true, (text) => {
        this.network.sendChatMessage(text);
      });
    }

    void this.sessionAdapter
      .start()
      .then(() => {
        this.network.sendEnemyStateRequest();
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error("Failed to start multiplayer session:", error);
        this.hud.showMessage("Nao foi possivel conectar ao multiplayer.", 2600);
      });
  }

  private handleRoomStateChange(state: SessionState): void {
    const currentPlayerIds = new Set(state.players.map((player) => player.id));

    for (const playerId of this.remotePlayers.keys()) {
      if (!currentPlayerIds.has(playerId)) {
        this.removeRemotePlayer(playerId);
      }
    }

    for (const player of state.players) {
      if (!this.remotePlayers.has(player.id)) {
        this.addRemotePlayer(player);
      } else {
        this.updateRemotePlayerState(player);
      }
    }

    this.updateMultiplayerHud(state.sessionId);
  }

  private handleNetworkEvent(event: GameNetworkEvent): void {
    switch (event.type) {
      case "playerJoined":
        this.addRemotePlayer(event.player);
        this.updateMultiplayerHud();
        break;
      case "playerLeft":
        this.removeRemotePlayer(event.playerId);
        this.updateMultiplayerHud();
        break;
      case "playerMoved":
        if (event.player) {
          this.updateRemotePlayerState(event.player);
        } else {
          this.updateRemotePlayerPose(event.playerId, event.position, event.rotationY);
        }
        break;
      case "playerAttackVisual":
        this.handleRemotePlayerAttackVisual(event);
        break;
      case "playerDamaged":
        this.handlePlayerDamaged(
          event.targetPlayerId,
          event.damage,
          event.health,
          event.attackerPlayerId
        );
        break;
      case "playerHealed":
        this.handlePlayerHealed(event.playerId, event.amount, event.health);
        break;
      case "playerDefeated":
        this.handlePlayerDefeated(event.playerId, event.defeatedByPlayerId);
        break;
      case "playerRespawned":
        this.handlePlayerRespawned(event.playerId, event.health, event.position);
        break;
      case "enemyState":
        this.mechanics?.applyEnemyState(event.enemies);
        break;
      case "enemyUpdated":
        this.mechanics?.applyEnemyUpdated(event.enemy);
        break;
      case "enemyDefeated":
        this.mechanics?.applyEnemyDefeated(event.enemyObjectId);
        if (
          event.defeatedByPlayerId &&
          canUseMultiplayerMechanics(this.sessionAdapter) &&
          event.defeatedByPlayerId === this.sessionAdapter.getLocalPlayerId()
        ) {
          this.hud.showMessage("Voce derrotou um inimigo.", 1400);
        }
        break;
      case "combatState":
        this.applyCombatState(event.players);
        break;
      case "chatHistory":
        this.chatMessages = event.messages.slice(-50);
        this.hud.setChatMessages(this.chatMessages);
        break;
      case "chatMessage":
        this.chatMessages = [...this.chatMessages, event.message].slice(-50);
        this.hud.setChatMessages(this.chatMessages);
        if (event.message.type === "system") {
          this.hud.showMessage(event.message.text, 1800);
        }
        break;
      case "hostChanged":
        this.updateMultiplayerHud();
        if (
          event.hostPlayerId &&
          canUseMultiplayerMechanics(this.sessionAdapter) &&
          event.hostPlayerId === this.sessionAdapter.getLocalPlayerId()
        ) {
          this.hud.showMessage("Voce agora e o host da sala.", 2200);
        }
        break;
      case "matchEnded":
        this.hud.showMessage(event.reason, 2600);
        break;
    }
  }

  private handleWorldState(state: SharedWorldState): void {
    this.latestSharedWorldState = cloneSharedWorldState(state);
    this.mechanics?.applySharedWorldState(state);
  }

  private handleWorldEvent(event: WorldEvent): void {
    this.latestSharedWorldState = mergeWorldEvent(this.latestSharedWorldState, event);
    this.mechanics?.applyWorldEvent(event);
  }

  private handlePlayerHealed(playerId: string, amount: number, health: number): void {
    const localPlayerId = canUseMultiplayerMechanics(this.sessionAdapter)
      ? this.sessionAdapter.getLocalPlayerId()
      : null;

    if (canUseMultiplayerMechanics(this.sessionAdapter) && playerId === localPlayerId) {
      this.mechanics?.applyLocalPlayerHealed(health, amount);
      return;
    }

    const previous = this.remotePlayerStates.get(playerId);
    if (!previous) {
      return;
    }

    this.updateRemotePlayerState({
      ...previous,
      health,
      isAlive: health > 0,
    });
    this.feedbackSystem.spawn("item", previous.position, `+${Math.round(amount)}`);
  }

  private addRemotePlayer(player: PlayerNetState): void {
    if (this.remotePlayers.has(player.id)) return;

    this.remotePlayerStates.set(player.id, { ...player, position: { ...player.position } });
    const remotePlayer = new RemotePlayerView(
      player.id,
      player.name,
      player.teamId,
      player.clientId ?? player.id
    );
    remotePlayer.addToScene(this.scene);
    remotePlayer.updateState(player);
    this.remotePlayers.set(player.id, remotePlayer);
  }

  private removeRemotePlayer(playerId: string): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {
      remotePlayer.removeFromScene(this.scene);
      remotePlayer.dispose();
      this.remotePlayers.delete(playerId);
    }
    this.remotePlayerStates.delete(playerId);
  }

  private updateRemotePlayerState(player: PlayerNetState): void {
    this.remotePlayerStates.set(player.id, { ...player, position: { ...player.position } });
    const remotePlayer = this.remotePlayers.get(player.id);
    if (remotePlayer) {
      remotePlayer.updateState(player);
    }
  }

  private updateRemotePlayerPose(playerId: string, position: Vector3, rotationY: number): void {
    const previous = this.remotePlayerStates.get(playerId);
    const next: PlayerNetState = {
      id: playerId,
      name: previous?.name ?? "",
      teamId: previous?.teamId ?? null,
      clientId: previous?.clientId,
      position,
      rotationY,
      health: previous?.health ?? 100,
      maxHealth: previous?.maxHealth ?? 100,
      equippedWeaponId: previous?.equippedWeaponId ?? null,
      score: previous?.score ?? 0,
      isAlive: previous?.isAlive ?? true,
    };
    this.updateRemotePlayerState(next);
  }

  private handleRemotePlayerAttackVisual(
    event: GameNetworkEvent & { type: "playerAttackVisual" }
  ): void {
    const remotePlayer = this.remotePlayers.get(event.playerId);
    if (!remotePlayer) {
      return;
    }

    remotePlayer.setEquippedWeapon(event.weaponId);
    remotePlayer.playAttackFeedback(event.attackType);
    this.mechanics?.applyRemoteAttackVisual({
      weaponId: event.weaponId,
      attackType: event.attackType,
      origin: event.origin,
      direction: event.direction,
    });
  }

  private handlePlayerDamaged(
    playerId: string,
    damage: number,
    health: number,
    attackerPlayerId?: string
  ): void {
    const localPlayerId = canUseMultiplayerMechanics(this.sessionAdapter)
      ? this.sessionAdapter.getLocalPlayerId()
      : null;
    const roundedDamage = Math.round(damage);

    if (canUseMultiplayerMechanics(this.sessionAdapter) && playerId === localPlayerId) {
      const attackerName = this.getPlayerDisplayName(attackerPlayerId);
      const message =
        attackerName && attackerName !== "Voce"
          ? `${attackerName} acertou voce (-${roundedDamage})`
          : `Dano recebido (-${roundedDamage})`;
      this.mechanics?.applyLocalPlayerHealth(health, message, damage);
      return;
    }

    const previous = this.remotePlayerStates.get(playerId);
    if (!previous) {
      return;
    }

    this.updateRemotePlayerState({
      ...previous,
      health,
      isAlive: health > 0,
    });
    this.remotePlayers.get(playerId)?.playDamageFeedback();

    if (attackerPlayerId && attackerPlayerId === localPlayerId) {
      this.audioSystem.play("hit");
      this.feedbackSystem.spawn("damage", previous.position, `-${roundedDamage}`);
      this.hud.showMessage(`Acerto em ${previous.name || "jogador"} (-${roundedDamage})`, 1200);
    }
  }

  private handlePlayerDefeated(playerId: string, defeatedByPlayerId?: string): void {
    const localPlayerId = canUseMultiplayerMechanics(this.sessionAdapter)
      ? this.sessionAdapter.getLocalPlayerId()
      : null;

    if (canUseMultiplayerMechanics(this.sessionAdapter) && playerId === localPlayerId) {
      const attackerName = this.getPlayerDisplayName(defeatedByPlayerId);
      this.mechanics?.applyLocalPlayerDefeated(
        attackerName && attackerName !== "Voce"
          ? `${attackerName} derrotou voce. Respawn em instantes.`
          : undefined
      );
      return;
    }

    const previous = this.remotePlayerStates.get(playerId);
    if (previous) {
      this.updateRemotePlayerState({ ...previous, health: 0, isAlive: false });
      this.remotePlayers.get(playerId)?.playDamageFeedback();

      if (defeatedByPlayerId && defeatedByPlayerId === localPlayerId) {
        this.audioSystem.play("hit");
        this.feedbackSystem.spawn("objective", previous.position, "Derrotado");
        this.hud.showMessage(`Voce derrotou ${previous.name || "jogador"}.`, 1600);
      }
    }
  }

  private handlePlayerRespawned(playerId: string, health: number, position: Vector3): void {
    if (
      canUseMultiplayerMechanics(this.sessionAdapter) &&
      playerId === this.sessionAdapter.getLocalPlayerId()
    ) {
      this.mechanics?.applyLocalPlayerRespawned(position, health);
      return;
    }

    const previous = this.remotePlayerStates.get(playerId);
    if (previous) {
      this.updateRemotePlayerState({
        ...previous,
        position,
        health,
        isAlive: true,
      });
      this.remotePlayers.get(playerId)?.playRespawnFeedback();
    }
  }

  private getPlayerDisplayName(playerId?: string): string | null {
    if (!playerId) {
      return null;
    }

    if (
      canUseMultiplayerMechanics(this.sessionAdapter) &&
      playerId === this.sessionAdapter.getLocalPlayerId()
    ) {
      return "Voce";
    }

    return this.remotePlayerStates.get(playerId)?.name ?? null;
  }

  private applyCombatState(players: Record<string, PlayerCombatState>): void {
    if (canUseMultiplayerMechanics(this.sessionAdapter)) {
      const localPlayerId = this.sessionAdapter.getLocalPlayerId();
      const localState = localPlayerId ? players[localPlayerId] : null;
      if (localState) {
        this.mechanics?.applyLocalPlayerHealth(localState.health);
      }
    }

    for (const [playerId, combatState] of Object.entries(players)) {
      if (
        canUseMultiplayerMechanics(this.sessionAdapter) &&
        playerId === this.sessionAdapter.getLocalPlayerId()
      ) {
        continue;
      }

      const previous = this.remotePlayerStates.get(playerId);
      if (previous) {
        this.updateRemotePlayerState({
          ...previous,
          health: combatState.health,
          maxHealth: combatState.maxHealth,
          isAlive: combatState.alive,
        });
      }
    }
  }

  private updateMultiplayerHud(roomId = this.sessionAdapter?.getState()?.sessionId): void {
    if (!roomId || !this.sessionAdapter || this.sessionAdapter.isLocal()) {
      this.hud.hideMultiplayerInfo();
      return;
    }

    const localPlayerId = this.network.getLocalPlayerId();
    const hostPlayerId = this.network.getHostPlayerId();
    const players = [
      {
        id: localPlayerId ?? "local-player",
        name: "Voce",
        isLocal: true,
        isHost: Boolean(localPlayerId && localPlayerId === hostPlayerId),
      },
      ...[...this.remotePlayerStates.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((player) => ({
          id: player.id,
          name: player.name || "Player",
          isLocal: false,
          isHost: player.id === hostPlayerId,
        })),
    ];

    this.hud.setMultiplayerInfo(
      {
        roomId,
        playerCount: players.length,
        hostPlayerId,
        localPlayerId,
        players,
      },
      () => {
        void this.sessionAdapter?.stop();
        this.clearRemotePlayers();
        this.hud.hideMultiplayerInfo();
        this.options.onBackToMenu?.();
      }
    );
  }

  getMap(): GameMap | null {
    return this.activeMap ? structuredClone(this.activeMap) : null;
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("keydown", this.handleRuntimeKeyDown);
    this.cameraController.releasePointerLock();
    this.cameraController.dispose();
    this.playerController.dispose();
    this.mechanics?.dispose();
    this.mechanics = null;
    this.audioSystem.dispose();
    this.feedbackSystem.dispose();
    this.hud.dispose();
    this.resizeObserver.disconnect();
    this.clearWorld();
    this.clearRemotePlayers();
    if (this.sessionAdapter) {
      void this.sessionAdapter.stop();
    }
    for (const child of [...this.scene.children]) {
      if (child !== this.world) {
        disposeObject3D(child);
      }
    }
    this.renderer.dispose();
    this.container.replaceChildren();
  }

  private clearRemotePlayers(): void {
    for (const remotePlayer of this.remotePlayers.values()) {
      remotePlayer.removeFromScene(this.scene);
      remotePlayer.dispose();
    }
    this.remotePlayers.clear();
    this.remotePlayerStates.clear();
  }

  private setupScene(): void {
    this.scene.add(this.world);

    this.ambientLight = new THREE.HemisphereLight("#ffffff", "#748293", 1.8);
    this.sunLight = new THREE.DirectionalLight("#ffffff", 2.2);
    this.sunLight.position.set(7, 12, 8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);

    this.scene.add(this.ambientLight, this.sunLight);
    this.applyVisualSettings();
  }

  private applyVisualSettings(): void {
    const settings = resolveVisualSettings(this.activeMap?.visualSettings);
    this.scene.background = new THREE.Color(settings.skyColor);
    this.scene.fog = settings.fogEnabled
      ? new THREE.Fog(settings.fogColor, settings.fogNear, settings.fogFar)
      : null;

    if (this.ambientLight) {
      this.ambientLight.intensity = settings.ambientLightIntensity;
    }

    if (this.sunLight) {
      this.sunLight.intensity = settings.sunLightIntensity;
    }
  }

  private clearWorld(): void {
    this.physicsSystem.clear();

    for (const child of [...this.world.children]) {
      this.world.remove(child);
      disposeObject3D(child);
    }

    this.objectViews.clear();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private animate = (): void => {
    const delta = this.clock.getDelta();

    if (!this.paused) {
      if (this.sessionTimerRunning) {
        this.sessionElapsedTime += delta;
        this.hud.setSessionTime(this.sessionElapsedTime);
      }

      this.cameraController.update();
      this.playerController.setViewYaw(this.cameraController.getYaw());
      this.playerController.update(delta);
      this.cameraController.update();
      this.mechanics?.update(delta);
      this.feedbackSystem.update(delta);

      for (const remotePlayer of this.remotePlayers.values()) {
        remotePlayer.update(delta);
      }

      this.syncMultiplayerState(delta);
    }

    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private syncMultiplayerState(delta: number): void {
    if (!this.sessionAdapter || this.sessionAdapter.isLocal()) {
      return;
    }

    this.networkSyncAccumulator += delta;
    if (this.networkSyncAccumulator < 0.05) {
      return;
    }
    this.networkSyncAccumulator = 0;

    const position = this.playerController.getPosition();
    const rotationY = this.cameraController.getYaw();
    const health = this.playerController.getHealth();
    const equippedWeaponId = this.mechanics?.getEquippedWeaponId() ?? null;
    const score = this.mechanics?.getScore() ?? 0;

    this.network.sendPlayerState(position, rotationY, health, equippedWeaponId, score);
  }

  private restart(): void {
    this.paused = false;
    this.hud.hidePause();
    this.hud.hideVictory();
    this.hud.hideDefeat();
    this.sessionElapsedTime = 0;
    this.sessionTimerRunning = true;
    this.hud.setSessionTime(0);
    this.feedbackSystem.clear();
    this.mechanics?.restart();
    if (this.latestSharedWorldState) {
      this.mechanics?.applySharedWorldState(this.latestSharedWorldState);
    }
    this.cameraController.reset();
  }

  private pause(): void {
    if (this.paused) {
      return;
    }

    this.paused = true;
    this.cameraController.releasePointerLock();
    this.hud.showPause();
  }

  private resume(): void {
    if (!this.paused) {
      return;
    }

    this.paused = false;
    this.hud.hidePause();
    this.renderer.domElement.focus();
  }

  private togglePause(): void {
    if (this.paused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  private editActiveMap(): void {
    if (this.activeMap) {
      this.options.onEditMap?.(structuredClone(this.activeMap));
    }
  }

  private readonly handleRuntimeKeyDown = (event: KeyboardEvent): void => {
    if (
      event.key === "Enter" &&
      this.sessionAdapter &&
      !this.sessionAdapter.isLocal() &&
      !isEditableTarget(event.target)
    ) {
      event.preventDefault();
      this.hud.focusChat();
      return;
    }

    if (
      event.key.toLowerCase() === "r" &&
      !isEditableTarget(event.target) &&
      !this.hud.isChatFocused()
    ) {
      event.preventDefault();
      this.audioSystem.play("uiClick");
      this.restart();
      return;
    }

    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();

    if (this.hud.isChatFocused()) {
      this.hud.blurChat();
      return;
    }

    this.togglePause();
  };

  private getSessionHudStatus(): RuntimeSessionHudStatus {
    const controls = ["WASD mover", "Space pular", "Mouse camera", "E interagir"];

    if (this.sessionAdapter && !this.sessionAdapter.isLocal()) {
      const detail = getMultiplayerSessionDetail(this.activeMap);
      return {
        label: "Multiplayer",
        detail,
        controls: [...controls, "Enter chat"],
      };
    }

    if (this.options.isTestMode) {
      return {
        label: "Testando mapa",
        detail: "R reinicia - Esc pausa",
        controls: [...controls, "R reiniciar"],
      };
    }

    return {
      label: "Solo",
      detail: "Jogo local",
      controls: [...controls, "Esc pausa"],
    };
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function getMultiplayerSessionDetail(map: GameMap | null): string {
  const mode = map?.gameModeSettings?.mode;

  if (mode === "teamBattle" || mode === "capturePoint") {
    return "PvP por times";
  }

  if (mode === "combatArena") {
    return map?.objects.some((object) => object.type === "enemy") ? "Coop combate" : "PvP arena";
  }

  return "Sala online";
}

function cloneSharedWorldState(state: SharedWorldState): SharedWorldState {
  return {
    openedDoorIds: [...state.openedDoorIds],
    activatedButtonIds: [...state.activatedButtonIds],
    collectedCoinObjectIds: [...state.collectedCoinObjectIds],
    collectedItemObjectIds: [...state.collectedItemObjectIds],
    tycoonPurchasedIds: [...(state.tycoonPurchasedIds ?? [])],
    tycoonUpgradeIds: [...(state.tycoonUpgradeIds ?? [])],
  };
}

function mergeWorldEvent(state: SharedWorldState | null, event: WorldEvent): SharedWorldState {
  const next =
    state ??
    ({
      openedDoorIds: [],
      activatedButtonIds: [],
      collectedCoinObjectIds: [],
      collectedItemObjectIds: [],
      tycoonPurchasedIds: [],
      tycoonUpgradeIds: [],
    } satisfies SharedWorldState);

  if (event.type === "doorOpened") {
    addUnique(next.openedDoorIds, event.doorId);
  } else if (event.type === "doorClosed") {
    removeValue(next.openedDoorIds, event.doorId);
  } else if (event.type === "buttonActivated") {
    addUnique(next.activatedButtonIds, event.objectId);
  } else if (event.type === "coinCollected") {
    addUnique(next.collectedCoinObjectIds, event.objectId);
  } else if (event.type === "itemCollected") {
    addUnique(next.collectedItemObjectIds, event.objectId);
  } else if (event.type === "tycoonPurchase") {
    addUnique(next.tycoonPurchasedIds, event.purchaseId);
  } else if (event.type === "tycoonUpgrade") {
    addUnique(next.tycoonUpgradeIds, event.upgradeId);
  }

  return cloneSharedWorldState(next);
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
