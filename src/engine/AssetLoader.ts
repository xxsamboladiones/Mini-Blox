import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { MapAsset } from "../shared/types/ObjectSchema";

export class AssetLoader {
  private readonly gltfLoader = new GLTFLoader();
  private readonly modelCache = new Map<string, THREE.Object3D>();

  async loadModelInstance(asset: MapAsset): Promise<THREE.Object3D> {
    if (asset.kind !== "model") {
      throw new Error(`Asset "${asset.name}" is not a model.`);
    }

    const cached = this.modelCache.get(asset.id);

    if (cached) {
      return cached.clone(true);
    }

    const source = asset.dataUrl ?? asset.url;

    if (!source) {
      throw new Error(`Model asset "${asset.name}" has no source.`);
    }

    const object = await new Promise<THREE.Object3D>((resolve, reject) => {
      this.gltfLoader.load(
        source,
        (gltf) => resolve(gltf.scene),
        undefined,
        (error) => reject(error)
      );
    });

    this.modelCache.set(asset.id, object);
    return object.clone(true);
  }
}
