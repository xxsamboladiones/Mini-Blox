import { describe, expect, it } from "vitest";
import { getBlockingValidationIssues, validateEditorMap } from "../editor/EditorMapValidator";
import { MAP_TEMPLATES, createMapFromTemplate } from "./MapTemplates";
import { normalizeGameMap } from "./normalizeGameMap";
import { createEmptyGameMap, type GameMap } from "./types/MapSchema";

describe("Map validation", () => {
  it("aceita todos os templates oficiais", () => {
    for (const template of MAP_TEMPLATES) {
      const map = createMapFromTemplate(template.id);
      const blockingIssues = getBlockingValidationIssues(validateEditorMap(map));

      expect(blockingIssues, template.id).toHaveLength(0);
    }
  });

  it("aceita o template Tycoon Basico", () => {
    const map = createMapFromTemplate("basicTycoon");
    const blockingIssues = getBlockingValidationIssues(validateEditorMap(map));

    expect(blockingIssues).toHaveLength(0);
  });

  it("falha quando um requiredPurchaseIds aponta para compra inexistente", () => {
    const map = createMapFromTemplate("basicTycoon");
    const button = findTycoonObject(map, "tycoonBuyButton");
    button.properties = {
      ...button.properties,
      requiredPurchaseIds: ["missing_purchase"],
    };

    const blockingIssues = getBlockingValidationIssues(validateEditorMap(map));

    expect(blockingIssues.some((issue) => issue.code === "tycoon.purchase.requiredMissing")).toBe(
      true
    );
  });

  it("falha quando unlockObjectIds aponta para objeto inexistente", () => {
    const map = createMapFromTemplate("basicTycoon");
    const button = findTycoonObject(map, "tycoonBuyButton");
    button.properties = {
      ...button.properties,
      unlockObjectIds: ["missing_unlockable"],
    };

    const blockingIssues = getBlockingValidationIssues(validateEditorMap(map));

    expect(blockingIssues.some((issue) => issue.code === "tycoon.unlock.objectMissing")).toBe(true);
  });

  it("falha quando winPurchaseIds aponta para compra inexistente", () => {
    const map = createMapFromTemplate("basicTycoon");
    map.gameModeSettings = {
      ...map.gameModeSettings,
      mode: "tycoon",
      tycoonSettings: {
        ...(map.gameModeSettings?.tycoonSettings ?? {}),
        winPurchaseIds: ["missing_win"],
      },
    };

    const blockingIssues = getBlockingValidationIssues(validateEditorMap(map));

    expect(blockingIssues.some((issue) => issue.code === "tycoon.win.purchaseMissing")).toBe(true);
  });

  it("falha quando objeto Tycoon nao tem tycoonId", () => {
    const map = createMapFromTemplate("basicTycoon");
    const generator = findTycoonObject(map, "tycoonGenerator");
    generator.properties = {
      ...generator.properties,
      tycoonId: "",
    };

    const blockingIssues = getBlockingValidationIssues(validateEditorMap(map));

    expect(blockingIssues.some((issue) => issue.code === "tycoon.id.missing")).toBe(true);
  });

  it("continua normalizando mapas antigos sem campos Tycoon explicitos", () => {
    const legacyMap = createEmptyGameMap("Mapa legado");
    legacyMap.objects = [
      {
        id: "legacy_cube",
        type: "cube",
        position: { x: 1, y: 0.5, z: 2 },
      },
    ];
    legacyMap.gameModeSettings = {
      mode: "freeplay",
    };

    const normalized = normalizeGameMap(legacyMap);

    expect(normalized.gameModeSettings?.mode).toBe("freeplay");
    expect(normalized.gameModeSettings?.tycoonSettings?.startingCash).toBe(0);
    expect(normalized.objects[0]?.scale).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("createEmptyGameMap cria mapa local valido", () => {
    const map = createEmptyGameMap("Novo teste");
    const blockingIssues = getBlockingValidationIssues(validateEditorMap(map));

    expect(blockingIssues).toHaveLength(0);
  });
});

function findTycoonObject(map: GameMap, type: string) {
  const object = map.objects.find((candidate) => candidate.type === type);
  if (!object) {
    throw new Error(`Objeto ${type} nao encontrado no template de teste.`);
  }

  return object;
}
