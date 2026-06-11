import { describe, expect, it } from "vitest";
import { createOnlineTestMap, createValidTycoonOnlineMap } from "../testing/createOnlineTestMap";
import { validateOnlineMap } from "./validateOnlineMap";

describe("validateOnlineMap", () => {
  it("aceita mapa valido antigo", () => {
    expect(validateOnlineMap(createOnlineTestMap({ id: "valid-freeplay" }))).toEqual({
      valid: true,
    });
  });

  it("aceita mapa Tycoon valido", () => {
    expect(validateOnlineMap(createValidTycoonOnlineMap())).toEqual({ valid: true });
  });

  it("rejeita Tycoon sem tycoonId", () => {
    const map = createValidTycoonOnlineMap();
    const button = findObject(map, "tycoonBuyButton");
    button.properties = {
      ...button.properties,
      tycoonId: "",
    };

    const validation = validateOnlineMap(map);

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("tycoonId");
  });

  it("rejeita purchaseId ausente", () => {
    const map = createValidTycoonOnlineMap();
    const button = findObject(map, "tycoonBuyButton");
    button.properties = {
      ...button.properties,
      purchaseId: "",
    };

    const validation = validateOnlineMap(map);

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("purchaseId");
  });

  it("rejeita winPurchaseIds inexistente", () => {
    const map = createValidTycoonOnlineMap();
    map.gameModeSettings = {
      ...map.gameModeSettings,
      mode: "tycoon",
      tycoonSettings: {
        ...(map.gameModeSettings?.tycoonSettings ?? {}),
        winPurchaseIds: ["missing_purchase"],
      },
    };

    const validation = validateOnlineMap(map);

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("missing purchase");
  });

  it("rejeita targetGeneratorIds inexistente", () => {
    const map = createValidTycoonOnlineMap();
    map.objects.push({
      id: "upgrade",
      type: "tycoonUpgrade",
      position: { x: 2, y: 0.5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      properties: {
        tycoonId: "factory_1",
        upgradeId: "upgrade_missing",
        cost: 1,
        targetGeneratorIds: ["missing_generator"],
      },
    });

    const validation = validateOnlineMap(map);

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("missing_generator");
  });

  it("rejeita targetCollectorId inexistente", () => {
    const map = createValidTycoonOnlineMap();
    const generator = findObject(map, "tycoonGenerator");
    generator.properties = {
      ...generator.properties,
      targetCollectorId: "missing_collector",
    };

    const validation = validateOnlineMap(map);

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("missing_collector");
  });

  it("rejeita custo negativo em objeto Tycoon", () => {
    const map = createValidTycoonOnlineMap();
    const button = map.objects.find((object) => object.type === "tycoonBuyButton");
    if (!button) {
      throw new Error("Botao Tycoon ausente no mapa de teste.");
    }
    button.properties = {
      ...button.properties,
      cost: -1,
    };

    const validation = validateOnlineMap(map);

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("cost");
  });

  it("rejeita tickInterval invalido", () => {
    const map = createValidTycoonOnlineMap();
    const generator = map.objects.find((object) => object.type === "tycoonGenerator");
    if (!generator) {
      throw new Error("Gerador Tycoon ausente no mapa de teste.");
    }
    generator.properties = {
      ...generator.properties,
      tickInterval: 0,
    };

    const validation = validateOnlineMap(map);

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("tickInterval");
  });

  it("rejeita incomePerTick absurdo", () => {
    const map = createValidTycoonOnlineMap();
    const generator = findObject(map, "tycoonGenerator");
    generator.properties = {
      ...generator.properties,
      incomePerTick: 1_000_001,
    };

    const validation = validateOnlineMap(map);

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("incomePerTick");
  });

  it("rejeita referencias inexistentes", () => {
    const map = createValidTycoonOnlineMap();
    const button = map.objects.find((object) => object.type === "tycoonBuyButton");
    if (!button) {
      throw new Error("Botao Tycoon ausente no mapa de teste.");
    }
    button.properties = {
      ...button.properties,
      unlockObjectIds: ["missing_wall"],
    };

    const validation = validateOnlineMap(map);

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("missing_wall");
  });

  it("rejeita arrays Tycoon enormes", () => {
    const map = createValidTycoonOnlineMap();
    const button = map.objects.find((object) => object.type === "tycoonBuyButton");
    if (!button) {
      throw new Error("Botao Tycoon ausente no mapa de teste.");
    }
    button.properties = {
      ...button.properties,
      unlockObjectIds: Array.from({ length: 101 }, (_, index) => `target_${index}`),
    };

    const validation = validateOnlineMap(map);

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("at most 100");
  });

  it("rejeita asset dataUrl grande", () => {
    const map = createOnlineTestMap({
      assets: [
        {
          id: "asset_big",
          name: "Grande",
          kind: "texture",
          dataUrl: `data:image/png;base64,${"a".repeat(2 * 1024 * 1024 + 1)}`,
        },
      ],
    });

    const validation = validateOnlineMap(map);

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("2MB");
  });

  it("rejeita campos suspeitos", () => {
    const map = createOnlineTestMap({
      objects: [
        {
          id: "bad",
          type: "cube",
          position: { x: 0, y: 0, z: 0 },
          properties: {
            onerror: "alert(1)",
          },
        },
      ],
    });

    const validation = validateOnlineMap(map);

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("suspicious field");
  });

  it("rejeita JSON acima do limite", () => {
    const oversizedMap = {
      ...createOnlineTestMap({ id: "huge-json" }),
      hugeBlob: "x".repeat(11 * 1024 * 1024),
    };

    const validation = validateOnlineMap(oversizedMap);

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("Map JSON exceeds");
  });

  it("continua aceitando mapas antigos validos", () => {
    expect(validateOnlineMap(createOnlineTestMap({ id: "legacy-valid" }))).toEqual({
      valid: true,
    });
  });
});

function findObject(map: ReturnType<typeof createValidTycoonOnlineMap>, type: string) {
  const object = map.objects.find((candidate) => candidate.type === type);
  if (!object) {
    throw new Error(`Objeto ${type} ausente no mapa de teste.`);
  }

  return object;
}
