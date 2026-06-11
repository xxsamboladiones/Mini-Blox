import { describe, expect, it } from "vitest";
import { createOnlineTestMap, createValidTycoonOnlineMap } from "../testing/createOnlineTestMap";
import { validateOnlineMap } from "./validateOnlineMap";

describe("validateOnlineMap", () => {
  it("aceita mapa Tycoon valido", () => {
    expect(validateOnlineMap(createValidTycoonOnlineMap())).toEqual({ valid: true });
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

  it("continua aceitando mapas antigos validos", () => {
    expect(validateOnlineMap(createOnlineTestMap({ id: "legacy-valid" }))).toEqual({
      valid: true,
    });
  });
});
