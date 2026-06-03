import type { MapObject, Vector3 } from "../shared/types/ObjectSchema";

export class TriggerSystem {
  getTriggers(objects: MapObject[]): MapObject[] {
    return objects.filter((object) => object.collider?.isTrigger);
  }

  containsPoint(trigger: MapObject, point: Vector3): boolean {
    const scale = trigger.scale ?? { x: 1, y: 1, z: 1 };
    const halfX = scale.x / 2;
    const halfY = scale.y / 2;
    const halfZ = scale.z / 2;

    return (
      point.x >= trigger.position.x - halfX &&
      point.x <= trigger.position.x + halfX &&
      point.y >= trigger.position.y - halfY &&
      point.y <= trigger.position.y + halfY &&
      point.z >= trigger.position.z - halfZ &&
      point.z <= trigger.position.z + halfZ
    );
  }
}
