import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { AssetLoader } from "../engine/AssetLoader";
import {
  applyObjectAppearanceToThree,
  applyObjectTransformToThree,
  createMapObject3D,
  disposeObject3D,
  stampMapObject3D,
  syncMapObjectFromThree,
} from "../engine/ObjectFactory";
import { PhysicsSystem } from "../engine/PhysicsSystem";
import {
  createMapObject as createMapObjectData,
  getObjectCatalogItem,
} from "../shared/ObjectCatalog";
import { normalizeGameMap } from "../shared/normalizeGameMap";
import { resolveVisualSettings } from "../shared/VisualSettings";
import type { GameMap } from "../shared/types/MapSchema";
import type { BuiltInObjectType, MapAsset, MapObject, Vector3 } from "../shared/types/ObjectSchema";
import type { LogicRule } from "../shared/types/ScriptSchema";
import {
  cloneEditorObjectWithNewId,
  ensureObjectDefaults,
  isValidSelectedObject,
  patchObjectProperties,
} from "./EditorObjectUtils";
import { readFileAsDataUrl } from "./readFileAsDataUrl";
import type { EditorTool } from "./ToolManager";

type EditorSceneOptions = {
  onSelectionChange?: (mapObject: MapObject | null) => void;
  onMapChange?: (map: GameMap) => void;
  onModeChange?: (mode: "edit" | "test") => void;
  onSceneCommit?: (event: EditorSceneCommitEvent) => void;
  onToast?: (message: string) => void;
};

type LoadMapOptions = {
  emitChange?: boolean;
};

type SnapOptions = {
  enabled: boolean;
  size: number;
};

export type EditorSceneChangeReason =
  | "object-added"
  | "object-deleted"
  | "object-duplicated"
  | "object-transform-commit"
  | "object-properties-commit"
  | "metadata-commit"
  | "environment-commit"
  | "audio-commit"
  | "logic-commit"
  | "objective-commit"
  | "game-mode-commit"
  | "map-imported"
  | "map-cleared"
  | "unknown";

export interface EditorSceneCommitEvent {
  reason: EditorSceneChangeReason;
  objectId?: string;
  before: GameMap;
  after: GameMap;
  selectedObjectIdBefore?: string | null;
  selectedObjectIdAfter?: string | null;
}

type PendingTransformCommit = {
  objectId: string;
  before: GameMap;
  selectedObjectIdBefore: string | null;
};

export class EditorScene {
  private map: GameMap;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly world = new THREE.Group();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly orbitControls: OrbitControls;
  private readonly transformControls: TransformControls;
  private readonly transformHelper: THREE.Object3D;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly clock = new THREE.Clock();
  private readonly assetLoader = new AssetLoader();
  private readonly physicsSystem = new PhysicsSystem();
  private readonly objectViews = new Map<string, THREE.Object3D>();
  private readonly selectionBox = new THREE.BoxHelper(new THREE.Object3D(), "#f59e0b");
  private readonly resizeObserver: ResizeObserver;
  private ambientLight: THREE.HemisphereLight | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private floor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null = null;
  private selectedId: string | null = null;
  private copiedObject: MapObject | null = null;
  private readonly hiddenObjectIds = new Set<string>();
  private animationFrame = 0;
  private mouseDownPosition: { x: number; y: number } | null = null;
  private mode: "edit" | "test" = "edit";
  private activeTool: EditorTool = "translate";
  private snapOptions: SnapOptions = { enabled: false, size: 0.5 };
  private pendingTransformCommit: PendingTransformCommit | null = null;

  constructor(
    private readonly container: HTMLElement,
    initialMap: GameMap,
    private readonly options: EditorSceneOptions = {}
  ) {
    this.map = normalizeGameMap(initialMap);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.className = "editor-canvas";
    this.container.replaceChildren(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(7, 6, 8);

    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.target.set(0, 0.8, 0);

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformHelper = this.transformControls.getHelper();
    this.transformControls.setMode("translate");
    this.scene.add(this.transformHelper);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    this.setupScene();
    this.bindEvents();
    this.resize();
  }

  async start(): Promise<void> {
    await this.loadMap(this.map);
    this.animate();
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp);
    this.transformControls.removeEventListener(
      "dragging-changed",
      this.handleTransformDraggingChanged
    );
    this.transformControls.removeEventListener("objectChange", this.handleTransformObjectChange);
    this.resizeObserver.disconnect();
    this.orbitControls.dispose();
    this.transformControls.dispose();
    this.clearWorld();
    disposeObject3D(this.scene);
    this.renderer.dispose();
    this.container.replaceChildren();
  }

  async loadMap(map: GameMap, options: LoadMapOptions = {}): Promise<void> {
    this.map = normalizeGameMap(map);
    this.hiddenObjectIds.clear();
    this.clearWorld();
    this.applyVisualSettings();

    for (const mapObject of this.map.objects) {
      await this.addViewForObject(mapObject);
    }

    this.rebuildPhysicsColliders();
    this.syncSpawnPointFromObjects();
    this.selectObject(null);

    if (options.emitChange !== false) {
      this.emitMapChange();
    }
  }

  getSnapshot(): GameMap {
    this.syncAllObjectsFromViews();
    this.syncSpawnPointFromObjects();
    return structuredClone(this.map);
  }

  getSelectedObject(): MapObject | null {
    if (!this.selectedId) {
      return null;
    }

    const selected = this.map.objects.find((mapObject) => mapObject.id === this.selectedId);
    return selected ? structuredClone(selected) : null;
  }

  getAssets(): MapAsset[] {
    return structuredClone(this.map.assets ?? []);
  }

  getObjects(): MapObject[] {
    this.syncAllObjectsFromViews();
    return structuredClone(this.map.objects);
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  getHiddenObjectIds(): string[] {
    return [...this.hiddenObjectIds];
  }

  updateMapInfo(
    patch: Partial<
      Pick<
        GameMap,
        | "name"
        | "authorId"
        | "description"
        | "creatorName"
        | "thumbnail"
        | "tags"
        | "isPublished"
        | "publishedAt"
        | "logicDebug"
        | "visualSettings"
        | "audioSettings"
        | "gameplaySettings"
        | "objectives"
        | "gameModeSettings"
        | "teams"
        | "onlineMetadata"
      >
    >
  ): void {
    Object.assign(this.map, patch);
    if (patch.visualSettings) {
      this.applyVisualSettings();
    }
    this.emitMapChange();
  }

  updateLogic(logic: LogicRule[]): void {
    this.map.logic = structuredClone(logic);
    this.emitMapChange();
  }

  captureThumbnail(): string | null {
    this.renderer.render(this.scene, this.camera);

    try {
      const source = this.renderer.domElement;
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 270;
      const context = canvas.getContext("2d");

      if (!context) {
        return null;
      }

      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.72);
    } catch {
      return null;
    }
  }

  async addObject(type: BuiltInObjectType): Promise<MapObject> {
    const before = this.createCommitSnapshot();
    const selectedObjectIdBefore = this.selectedId;

    if (type === "spawn") {
      const existingSpawn = this.map.objects.find((mapObject) => mapObject.type === "spawn");

      if (existingSpawn) {
        existingSpawn.position = this.getPlacementPoint(type);
        this.map.spawnPoint = { ...existingSpawn.position };
        const existingView = this.objectViews.get(existingSpawn.id);

        if (existingView) {
          applyObjectTransformToThree(existingView, existingSpawn);
        }

        this.selectObject(existingSpawn.id);
        this.emitMapChange();
        this.emitSceneCommit(
          "object-transform-commit",
          existingSpawn.id,
          before,
          selectedObjectIdBefore
        );
        return structuredClone(existingSpawn);
      }
    }

    const properties = type === "button" ? this.getSuggestedButtonProperties() : undefined;
    const mapObject = createMapObjectData(type, this.getPlacementPoint(type), {
      name: this.getNextObjectName(type),
      properties,
    });
    this.map.objects.push(mapObject);
    await this.addViewForObject(mapObject);
    this.refreshCollider(mapObject.id);
    this.selectObject(mapObject.id);
    this.emitMapChange();
    this.emitSceneCommit("object-added", mapObject.id, before, selectedObjectIdBefore);
    return structuredClone(mapObject);
  }

  async importModel(file: File): Promise<MapObject> {
    const before = this.createCommitSnapshot();
    const selectedObjectIdBefore = this.selectedId;
    const dataUrl = await readFileAsDataUrl(file);
    const asset: MapAsset = {
      id: createId("asset"),
      name: file.name,
      kind: "model",
      mimeType: file.type || "model/gltf-binary",
      dataUrl,
    };

    this.map.assets = [...(this.map.assets ?? []), asset];

    const mapObject = createMapObjectData("model", this.getPlacementPoint("model"), {
      name: file.name.replace(/\.[^.]+$/, ""),
      assetId: asset.id,
    });

    this.map.objects.push(mapObject);
    await this.addViewForObject(mapObject);
    this.refreshCollider(mapObject.id);
    this.selectObject(mapObject.id);
    this.emitMapChange();
    this.emitSceneCommit("object-added", mapObject.id, before, selectedObjectIdBefore);
    return structuredClone(mapObject);
  }

  setTool(tool: EditorTool): void {
    this.activeTool = tool;

    if (tool === "select") {
      this.transformHelper.visible = false;
      this.transformControls.detach();
      return;
    }

    const transformMode = tool === "translate" ? "translate" : tool;
    this.transformControls.setMode(transformMode);
    this.transformHelper.visible = this.mode === "edit" && Boolean(this.selectedId);

    if (this.selectedId) {
      const view = this.objectViews.get(this.selectedId);

      if (view) {
        this.transformControls.attach(view);
      }
    }
  }

  setSnapOptions(options: SnapOptions): void {
    const size = Number.isFinite(options.size) && options.size > 0 ? options.size : 0.5;
    this.snapOptions = { enabled: options.enabled, size };
    this.transformControls.setTranslationSnap(options.enabled ? size : null);
    this.transformControls.setScaleSnap(options.enabled ? size : null);
    this.transformControls.setRotationSnap(options.enabled ? getRotationSnap(size) : null);
  }

  selectObjectById(id: string | null): void {
    this.selectObject(id);
  }

  deselectObject(): void {
    this.selectObject(null);
  }

  updateSelectedObject(patch: Partial<MapObject>): void {
    if (!this.selectedId) {
      return;
    }

    const mapObject = this.map.objects.find((candidate) => candidate.id === this.selectedId);
    const view = this.objectViews.get(this.selectedId);

    if (!mapObject || !view) {
      return;
    }

    Object.assign(mapObject, patchObjectProperties(mapObject, patch));

    applyObjectTransformToThree(view, mapObject);
    applyObjectAppearanceToThree(view, mapObject);
    this.refreshCollider(mapObject.id);
    this.refreshSelectionBox();
    this.syncSpawnPointFromObjects();
    this.options.onSelectionChange?.(structuredClone(mapObject));
    this.emitMapChange();
  }

  copySelectedObject(): boolean {
    if (!this.selectedId) {
      return false;
    }

    const source = this.map.objects.find((mapObject) => mapObject.id === this.selectedId);

    if (!source) {
      return false;
    }

    this.syncSelectedObjectFromView();
    this.copiedObject = structuredClone(source);
    return true;
  }

  async pasteCopiedObject(): Promise<MapObject | null> {
    if (!this.copiedObject) {
      return null;
    }

    const before = this.createCommitSnapshot();
    const selectedObjectIdBefore = this.selectedId;
    const duplicate = this.createDuplicateObject(this.copiedObject);
    this.map.objects.push(duplicate);
    await this.addViewForObject(duplicate);
    this.selectObject(duplicate.id);
    this.emitMapChange();
    this.emitSceneCommit("object-duplicated", duplicate.id, before, selectedObjectIdBefore);
    return structuredClone(duplicate);
  }

  async duplicateSelectedObject(): Promise<MapObject | null> {
    if (!this.selectedId) {
      return null;
    }

    const source = this.map.objects.find((mapObject) => mapObject.id === this.selectedId);

    if (!source) {
      return null;
    }

    this.syncSelectedObjectFromView();
    const before = this.createCommitSnapshot();
    const selectedObjectIdBefore = this.selectedId;
    const duplicate = this.createDuplicateObject(source);
    this.map.objects.push(duplicate);
    await this.addViewForObject(duplicate);
    this.selectObject(duplicate.id);
    this.emitMapChange();
    this.emitSceneCommit("object-duplicated", duplicate.id, before, selectedObjectIdBefore);
    return structuredClone(duplicate);
  }

  deleteSelectedObject(): boolean {
    if (!this.selectedId) {
      return false;
    }

    const before = this.createCommitSnapshot();
    const selectedObjectIdBefore = this.selectedId;
    const selected = this.selectedId;
    const view = this.objectViews.get(selected);

    if (view) {
      this.world.remove(view);
      disposeObject3D(view);
      this.objectViews.delete(selected);
      this.physicsSystem.removeCollider(selected);
      this.hiddenObjectIds.delete(selected);
    }

    this.map.objects = this.map.objects.filter((mapObject) => mapObject.id !== selected);
    this.selectObject(null);
    this.syncSpawnPointFromObjects();
    this.emitMapChange();
    this.emitSceneCommit("object-deleted", selected, before, selectedObjectIdBefore);
    return true;
  }

  setObjectVisibility(objectId: string, visible: boolean): boolean {
    const view = this.objectViews.get(objectId);

    if (!view) {
      return false;
    }

    view.visible = visible;

    if (visible) {
      this.hiddenObjectIds.delete(objectId);
      this.refreshCollider(objectId);
    } else {
      this.hiddenObjectIds.add(objectId);
      this.physicsSystem.removeCollider(objectId);

      if (this.selectedId === objectId) {
        this.selectObject(null);
      }
    }

    return true;
  }

  toggleObjectVisibility(objectId: string): boolean {
    return this.setObjectVisibility(objectId, this.hiddenObjectIds.has(objectId));
  }

  focusSelectedObject(): boolean {
    if (!this.selectedId) {
      return false;
    }

    return this.focusObjectById(this.selectedId);
  }

  focusObjectById(objectId: string): boolean {
    const view = this.objectViews.get(objectId);

    if (!view) {
      return false;
    }

    this.focusObject3D(view);
    return true;
  }

  focusMap(): void {
    if (this.objectViews.size === 0) {
      this.orbitControls.target.set(0, 0.8, 0);
      this.camera.position.set(7, 6, 8);
      this.orbitControls.update();
      return;
    }

    const bounds = new THREE.Box3();

    for (const view of this.objectViews.values()) {
      if (view.visible) {
        bounds.expandByObject(view);
      }
    }

    if (bounds.isEmpty()) {
      this.orbitControls.target.set(0, 0.8, 0);
      this.camera.position.set(7, 6, 8);
      this.orbitControls.update();
      return;
    }

    this.focusBounds(bounds, 1.65);
  }

  enterTestMode(): void {
    if (this.mode === "test") {
      return;
    }

    this.mode = "test";
    this.selectObject(null);
    this.transformHelper.visible = false;
    this.orbitControls.enabled = false;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.options.onModeChange?.("test");
  }

  exitTestMode(): void {
    if (this.mode === "edit") {
      return;
    }

    this.mode = "edit";
    this.container.replaceChildren(this.renderer.domElement);
    this.orbitControls.enabled = true;
    this.resize();
    this.orbitControls.update();
    this.animate();
    this.options.onModeChange?.("edit");
  }

  private setupScene(): void {
    this.scene.add(this.world);
    this.scene.add(this.selectionBox);
    this.selectionBox.visible = false;

    this.ambientLight = new THREE.HemisphereLight("#ffffff", "#778899", 1.8);
    this.sunLight = new THREE.DirectionalLight("#ffffff", 2.3);
    this.sunLight.position.set(7, 12, 8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);

    const grid = new THREE.GridHelper(80, 80, "#5c6f82", "#b9c6d3");
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({
        color: "#edf4fb",
        roughness: 0.85,
        metalness: 0,
      })
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.02;
    this.floor.receiveShadow = true;

    this.scene.add(this.ambientLight, this.sunLight, this.floor, grid);
    this.applyVisualSettings();
  }

  private applyVisualSettings(): void {
    const settings = resolveVisualSettings(this.map.visualSettings);
    this.map.visualSettings = { ...settings };
    this.scene.background = new THREE.Color(settings.skyColor);
    this.scene.fog = settings.fogEnabled
      ? new THREE.Fog(settings.fogColor, settings.fogNear, settings.fogFar)
      : null;

    if (this.floor) {
      this.floor.material.color.set(settings.groundColor);
      this.floor.material.needsUpdate = true;
    }

    if (this.ambientLight) {
      this.ambientLight.intensity = settings.ambientLightIntensity;
    }

    if (this.sunLight) {
      this.sunLight.intensity = settings.sunLightIntensity;
    }
  }

  private bindEvents(): void {
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
    this.transformControls.addEventListener(
      "dragging-changed",
      this.handleTransformDraggingChanged
    );
    this.transformControls.addEventListener("objectChange", this.handleTransformObjectChange);
  }

  private async addViewForObject(mapObject: MapObject): Promise<void> {
    const object3D = createMapObject3D(mapObject);

    if (mapObject.type === "model" && mapObject.assetId) {
      await this.replacePlaceholderWithModel(mapObject, object3D);
    }

    this.objectViews.set(mapObject.id, object3D);
    this.world.add(object3D);
    this.refreshCollider(mapObject.id);
  }

  private async replacePlaceholderWithModel(
    mapObject: MapObject,
    object3D: THREE.Object3D
  ): Promise<void> {
    const asset = this.map.assets?.find((candidate) => candidate.id === mapObject.assetId);

    if (!asset) {
      return;
    }

    try {
      disposeObject3D(object3D);
      object3D.clear();
      const model = await this.assetLoader.loadModelInstance(asset);
      normalizeImportedModel(model);
      object3D.add(model);
      stampMapObject3D(object3D, mapObject.id);
    } catch {
      this.options.onToast?.("Nao foi possivel carregar o modelo importado.");
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

  private selectFromPointer(event: PointerEvent): void {
    if (this.mode !== "edit") {
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster.intersectObjects([...this.objectViews.values()], true);
    const hit = hits.find((candidate) => candidate.object.userData.mapObjectId);
    this.selectObject(hit?.object.userData.mapObjectId ?? null);
  }

  private selectObject(id: string | null): void {
    this.selectedId = isValidSelectedObject(id, this.map.objects) ? id : null;
    this.transformControls.detach();
    this.transformHelper.visible = false;
    this.selectionBox.visible = false;

    if (!this.selectedId) {
      this.options.onSelectionChange?.(null);
      return;
    }

    const view = this.objectViews.get(this.selectedId);
    const mapObject = this.map.objects.find((candidate) => candidate.id === this.selectedId);

    if (!view || !mapObject) {
      this.options.onSelectionChange?.(null);
      return;
    }

    if (this.activeTool !== "select") {
      this.transformControls.attach(view);
      this.transformHelper.visible = this.mode === "edit";
    }

    this.selectionBox.setFromObject(view);
    this.selectionBox.visible = true;
    this.options.onSelectionChange?.(structuredClone(mapObject));
  }

  private syncSelectedObjectFromView(): void {
    if (!this.selectedId) {
      return;
    }

    const mapObject = this.map.objects.find((candidate) => candidate.id === this.selectedId);
    const view = this.objectViews.get(this.selectedId);

    if (!mapObject || !view) {
      return;
    }

    syncMapObjectFromThree(mapObject, view);
    this.refreshCollider(mapObject.id);
    this.syncSpawnPointFromObjects();
    this.options.onSelectionChange?.(structuredClone(mapObject));
  }

  private syncAllObjectsFromViews(): void {
    for (const mapObject of this.map.objects) {
      const view = this.objectViews.get(mapObject.id);

      if (view) {
        syncMapObjectFromThree(mapObject, view);
        this.refreshCollider(mapObject.id);
      }
    }
  }

  private rebuildPhysicsColliders(): void {
    this.syncAllObjectsFromViews();
    this.physicsSystem.setCollidersFromObjects(this.map, this.objectViews);
  }

  private refreshCollider(objectId: string): void {
    const mapObject = this.map.objects.find((candidate) => candidate.id === objectId);
    const view = this.objectViews.get(objectId);

    if (!mapObject || !view) {
      this.physicsSystem.removeCollider(objectId);
      return;
    }

    this.physicsSystem.updateColliderForObject(mapObject, view);
  }

  private createDuplicateObject(source: MapObject): MapObject {
    const duplicate: MapObject = cloneEditorObjectWithNewId(source, {
      name: this.getCopyName(source.name ?? String(source.type)),
      position: this.offsetPlacementPoint(source.position),
    });

    if (duplicate.type === "door") {
      duplicate.properties = {
        ...duplicate.properties,
        doorId: duplicate.id,
      };
    } else if (duplicate.type === "checkpoint") {
      duplicate.properties = {
        ...duplicate.properties,
        checkpointId: duplicate.id,
      };
    } else if (duplicate.type === "teleporter") {
      duplicate.properties = {
        ...duplicate.properties,
        teleporterId: duplicate.id,
        targetTeleporterId: "",
      };
    }

    return ensureObjectDefaults(duplicate);
  }

  private getNextObjectName(type: BuiltInObjectType): string {
    const baseName = getObjectNameBase(type);
    let index = 1;

    while (this.map.objects.some((mapObject) => mapObject.name === `${baseName} ${index}`)) {
      index += 1;
    }

    return `${baseName} ${index}`;
  }

  private getCopyName(sourceName: string): string {
    const baseName = sourceName.replace(/\s+copia(?:\s+\d+)?$/i, "");
    let index = 1;
    let nextName = `${baseName} copia`;

    while (this.map.objects.some((mapObject) => mapObject.name === nextName)) {
      index += 1;
      nextName = `${baseName} copia ${index}`;
    }

    return nextName;
  }

  private getSuggestedButtonProperties(): MapObject["properties"] | undefined {
    const latestDoor = [...this.map.objects]
      .reverse()
      .find((mapObject) => mapObject.type === "door");

    if (!latestDoor) {
      return undefined;
    }

    const targetDoorId =
      typeof latestDoor.properties?.doorId === "string"
        ? latestDoor.properties.doorId
        : latestDoor.id;

    return {
      targetDoorId,
      buttonTargetId: targetDoorId,
    };
  }

  private syncSpawnPointFromObjects(): void {
    const spawn = this.map.objects.find((mapObject) => mapObject.type === "spawn");

    if (spawn) {
      this.map.spawnPoint = { ...spawn.position };
    }
  }

  private refreshSelectionBox(): void {
    if (!this.selectedId) {
      this.selectionBox.visible = false;
      return;
    }

    const view = this.objectViews.get(this.selectedId);

    if (!view) {
      this.selectionBox.visible = false;
      return;
    }

    this.selectionBox.setFromObject(view);
    this.selectionBox.visible = true;
  }

  private getPlacementPoint(type: BuiltInObjectType): Vector3 {
    const ray = new THREE.Ray();
    this.camera.getWorldDirection(ray.direction);
    ray.origin.copy(this.camera.position);

    const point = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = ray.intersectPlane(plane, point);
    const scale = getObjectCatalogItem(type).defaultScale;
    const y =
      type === "spawn" ||
      type === "coin" ||
      type === "checkpoint" ||
      type === "finish" ||
      type === "npc" ||
      type === "itemSpawner" ||
      type === "teamSpawn" ||
      type === "capturePoint" ||
      type === "teleporter" ||
      type === "messageZone" ||
      type === "key" ||
      type === "tree" ||
      type === "rock" ||
      type === "crate" ||
      type === "barrel" ||
      type === "sign" ||
      type === "lamp" ||
      type === "arch" ||
      type === "pillar"
        ? 0
        : scale.y / 2;

    if (!hit) {
      point.copy(this.orbitControls.target);
    }

    return this.offsetPlacementPoint({
      x: snap(point.x),
      y: snap(y),
      z: snap(point.z),
    });
  }

  private offsetPlacementPoint(point: Vector3): Vector3 {
    const result = { ...point };
    const step = this.snapOptions.enabled ? this.snapOptions.size : 0.5;
    let attempts = 0;

    while (attempts < 16 && this.hasObjectNear(result)) {
      result.x = snapTo(point.x + step * (attempts + 1), step);
      result.z = snapTo(point.z + step * Math.floor((attempts + 1) / 2), step);
      attempts += 1;
    }

    return result;
  }

  private hasObjectNear(point: Vector3): boolean {
    return this.map.objects.some(
      (mapObject) =>
        Math.abs(mapObject.position.x - point.x) < 0.05 &&
        Math.abs(mapObject.position.y - point.y) < 0.05 &&
        Math.abs(mapObject.position.z - point.z) < 0.05
    );
  }

  private applySnapToSelectedObject(): void {
    if (!this.snapOptions.enabled || !this.selectedId) {
      return;
    }

    const view = this.objectViews.get(this.selectedId);

    if (!view) {
      return;
    }

    const size = this.snapOptions.size;
    const rotationSnap = getRotationSnap(size);

    if (this.activeTool === "translate") {
      view.position.set(
        snapTo(view.position.x, size),
        snapTo(view.position.y, size),
        snapTo(view.position.z, size)
      );
    } else if (this.activeTool === "scale") {
      view.scale.set(
        Math.max(0.05, snapTo(view.scale.x, size)),
        Math.max(0.05, snapTo(view.scale.y, size)),
        Math.max(0.05, snapTo(view.scale.z, size))
      );
    } else if (this.activeTool === "rotate") {
      view.rotation.set(
        snapTo(view.rotation.x, rotationSnap),
        snapTo(view.rotation.y, rotationSnap),
        snapTo(view.rotation.z, rotationSnap)
      );
    }
  }

  private focusObject3D(object3D: THREE.Object3D): void {
    const bounds = new THREE.Box3().setFromObject(object3D);

    if (bounds.isEmpty()) {
      return;
    }

    this.focusBounds(bounds, 2.2);
  }

  private focusBounds(bounds: THREE.Box3, padding: number): void {
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    bounds.getCenter(center);
    bounds.getSize(size);

    const radius = Math.max(size.x, size.y, size.z, 1);
    const direction = new THREE.Vector3().subVectors(
      this.camera.position,
      this.orbitControls.target
    );

    if (direction.lengthSq() < 0.01) {
      direction.set(1, 0.85, 1);
    }

    direction.normalize();
    const distance = Math.max(radius * padding, 4);
    this.orbitControls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.camera.position.y = Math.max(this.camera.position.y, center.y + radius * 0.65);
    this.orbitControls.update();
  }

  private emitMapChange(): void {
    this.options.onMapChange?.(this.getSnapshot());
  }

  private createCommitSnapshot(): GameMap {
    return this.getSnapshot();
  }

  private emitSceneCommit(
    reason: EditorSceneChangeReason,
    objectId: string | undefined,
    before: GameMap,
    selectedObjectIdBefore: string | null
  ): void {
    const after = this.getSnapshot();

    if (areMapsEquivalent(before, after)) {
      return;
    }

    this.options.onSceneCommit?.({
      reason,
      objectId,
      before,
      after,
      selectedObjectIdBefore,
      selectedObjectIdAfter: this.selectedId,
    });
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private animate = (): void => {
    this.clock.getDelta();

    if (this.mode === "edit") {
      this.orbitControls.update();
      this.renderer.render(this.scene, this.camera);
      this.animationFrame = requestAnimationFrame(this.animate);
    }
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.renderer.domElement.focus();
    this.mouseDownPosition = { x: event.clientX, y: event.clientY };
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.mouseDownPosition) {
      return;
    }

    const distance = Math.hypot(
      event.clientX - this.mouseDownPosition.x,
      event.clientY - this.mouseDownPosition.y
    );
    this.mouseDownPosition = null;

    if (distance < 4) {
      this.selectFromPointer(event);
    }
  };

  private readonly handleTransformDraggingChanged = (event: { value: unknown }): void => {
    const dragging = event.value === true;
    this.orbitControls.enabled = this.mode === "edit" && !dragging;

    if (this.mode !== "edit") {
      return;
    }

    if (dragging) {
      if (this.selectedId && !this.pendingTransformCommit) {
        this.pendingTransformCommit = {
          objectId: this.selectedId,
          before: this.createCommitSnapshot(),
          selectedObjectIdBefore: this.selectedId,
        };
      }
      return;
    }

    if (!this.pendingTransformCommit) {
      return;
    }

    const pending = this.pendingTransformCommit;
    this.pendingTransformCommit = null;
    this.syncSelectedObjectFromView();
    this.refreshSelectionBox();
    this.emitSceneCommit(
      "object-transform-commit",
      pending.objectId,
      pending.before,
      pending.selectedObjectIdBefore
    );
  };

  private readonly handleTransformObjectChange = (): void => {
    this.applySnapToSelectedObject();
    this.syncSelectedObjectFromView();
    this.refreshSelectionBox();
    this.emitMapChange();
  };
}

function normalizeImportedModel(model: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxAxis = Math.max(size.x, size.y, size.z);

  if (maxAxis > 0) {
    model.scale.multiplyScalar(1.6 / maxAxis);
  }

  model.position.sub(center);
  model.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function snap(value: number): number {
  return Math.round(value * 2) / 2;
}

function snapTo(value: number, size: number): number {
  if (!Number.isFinite(size) || size <= 0) {
    return value;
  }

  return Number((Math.round(value / size) * size).toFixed(4));
}

function getRotationSnap(size: number): number {
  return THREE.MathUtils.degToRad(size >= 1 ? 45 : 15);
}

function getObjectNameBase(type: BuiltInObjectType): string {
  switch (type) {
    case "cube":
      return "Bloco";
    case "ramp":
      return "Rampa";
    case "platform":
      return "Plataforma";
    case "movingPlatform":
      return "Plataforma movel";
    case "disappearingBlock":
      return "Bloco que some";
    case "jumpPad":
      return "Jump Pad";
    case "spawn":
      return "Spawn";
    case "damage":
      return "Zona de dano";
    case "teleporter":
      return "Teleporte";
    case "messageZone":
      return "Mensagem";
    case "checkpoint":
      return "Checkpoint";
    case "coin":
      return "Moeda";
    case "key":
      return "Chave";
    case "door":
      return "Porta";
    case "button":
      return "Botao";
    case "finish":
      return "Final";
    case "npc":
      return "NPC";
    case "itemSpawner":
      return "Item Spawner";
    case "teamSpawn":
      return "Spawn de Time";
    case "capturePoint":
      return "Capture Point";
    case "tree":
      return "Arvore";
    case "rock":
      return "Pedra";
    case "crate":
      return "Caixa";
    case "barrel":
      return "Barril";
    case "sign":
      return "Placa";
    case "lamp":
      return "Lampada";
    case "arch":
      return "Arco";
    case "pillar":
      return "Pilar";
    case "model":
      return "Modelo";
    default:
      return getObjectCatalogItem(type).label;
  }
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function areMapsEquivalent(a: GameMap, b: GameMap): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
