import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AssetLoader } from "./AssetLoader";
import { createMapObject3D, disposeObject3D, stampMapObject3D } from "./ObjectFactory";
import { SceneLoader } from "./SceneLoader";
import type { GameMap } from "../shared/types/MapSchema";
import type { Vector3 } from "../shared/types/ObjectSchema";

export class GameEngine {
  private activeMap: GameMap | null = null;
  private container: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private readonly scene = new THREE.Scene();
  private readonly world = new THREE.Group();
  private controls: OrbitControls | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animationFrame = 0;
  private readonly assetLoader = new AssetLoader();

  constructor(private readonly sceneLoader = new SceneLoader()) {}

  mount(container: HTMLElement): void {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.replaceChildren(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 800);
    this.camera.position.set(7, 6, 8);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1, 0);
    this.controls.enableDamping = true;

    this.scene.background = new THREE.Color("#b9d7ff");
    this.scene.add(this.world);
    this.addLights();
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.start();
  }

  async loadMapFile(url: string): Promise<GameMap> {
    this.activeMap = await this.sceneLoader.loadFromUrl(url);
    await this.buildActiveMap();
    return this.activeMap;
  }

  async loadMapData(data: unknown): Promise<GameMap> {
    this.activeMap = this.sceneLoader.loadFromData(data);
    await this.buildActiveMap();
    return this.activeMap;
  }

  getCurrentMap(): GameMap | null {
    return this.activeMap;
  }

  getSpawnPoint(): Vector3 {
    if (!this.activeMap) {
      throw new Error("No map has been loaded.");
    }

    return this.activeMap.spawnPoint;
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.clearWorld();
    disposeObject3D(this.scene);
    this.renderer?.dispose();
    this.container?.replaceChildren();
  }

  private start(): void {
    cancelAnimationFrame(this.animationFrame);

    const tick = () => {
      this.controls?.update();
      this.renderer?.render(this.scene, this.camera as THREE.Camera);
      this.animationFrame = requestAnimationFrame(tick);
    };

    tick();
  }

  private async buildActiveMap(): Promise<void> {
    this.clearWorld();

    if (!this.activeMap) {
      return;
    }

    for (const mapObject of this.activeMap.objects) {
      const object3D = createMapObject3D(mapObject);

      if (mapObject.type === "model" && mapObject.assetId) {
        const asset = this.activeMap.assets?.find(
          (candidate) => candidate.id === mapObject.assetId
        );

        if (asset) {
          object3D.clear();
          const model = await this.assetLoader.loadModelInstance(asset);
          object3D.add(model);
          stampMapObject3D(object3D, mapObject.id);
        }
      }

      this.world.add(object3D);
    }

    this.focusSpawnPoint();
  }

  private clearWorld(): void {
    for (const child of [...this.world.children]) {
      this.world.remove(child);
      disposeObject3D(child);
    }
  }

  private focusSpawnPoint(): void {
    if (!this.activeMap || !this.controls || !this.camera) {
      return;
    }

    const spawn = this.activeMap.spawnPoint;
    this.controls.target.set(spawn.x, spawn.y, spawn.z);
    this.camera.position.set(spawn.x + 7, spawn.y + 5, spawn.z + 8);
  }

  private addLights(): void {
    const ambient = new THREE.HemisphereLight("#ffffff", "#6c7a89", 1.7);
    const sun = new THREE.DirectionalLight("#ffffff", 2.1);
    sun.position.set(5, 10, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);

    const grid = new THREE.GridHelper(80, 80, "#7e8a99", "#c8d0d9");
    this.scene.add(ambient, sun, grid);
  }

  private resize(): void {
    if (!this.container || !this.renderer || !this.camera) {
      return;
    }

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
