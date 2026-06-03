import * as THREE from "three";

export class CameraController {
  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly offset = new THREE.Vector3(6, 5, 7)
  ) {}

  follow(target: THREE.Vector3, alpha = 0.16): void {
    const desiredPosition = target.clone().add(this.offset);
    this.camera.position.lerp(desiredPosition, alpha);
    this.camera.lookAt(target.x, target.y + 0.8, target.z);
  }
}
