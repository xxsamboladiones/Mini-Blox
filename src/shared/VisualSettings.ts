import type { VisualSettings, VisualTheme } from "./types/MapSchema";

export const DEFAULT_VISUAL_SETTINGS: Required<VisualSettings> = {
  theme: "classic",
  skyColor: "#d8ecff",
  groundColor: "#eef5f8",
  fogEnabled: false,
  fogColor: "#d8ecff",
  fogNear: 18,
  fogFar: 90,
  ambientLightIntensity: 1.65,
  sunLightIntensity: 2.35
};

export const MAP_THEME_PRESETS: Record<VisualTheme, Required<VisualSettings>> = {
  classic: DEFAULT_VISUAL_SETTINGS,
  grass: {
    theme: "grass",
    skyColor: "#ccefff",
    groundColor: "#77c96d",
    fogEnabled: true,
    fogColor: "#d6f5df",
    fogNear: 34,
    fogFar: 122,
    ambientLightIntensity: 1.75,
    sunLightIntensity: 2.55
  },
  desert: {
    theme: "desert",
    skyColor: "#ffd9a6",
    groundColor: "#e6b95f",
    fogEnabled: true,
    fogColor: "#f2cf95",
    fogNear: 30,
    fogFar: 118,
    ambientLightIntensity: 1.85,
    sunLightIntensity: 2.9
  },
  neon: {
    theme: "neon",
    skyColor: "#070b1f",
    groundColor: "#0f172a",
    fogEnabled: true,
    fogColor: "#211052",
    fogNear: 16,
    fogFar: 88,
    ambientLightIntensity: 1.05,
    sunLightIntensity: 2.05
  },
  dark: {
    theme: "dark",
    skyColor: "#131827",
    groundColor: "#202938",
    fogEnabled: true,
    fogColor: "#182033",
    fogNear: 14,
    fogFar: 76,
    ambientLightIntensity: 1.05,
    sunLightIntensity: 1.45
  }
};

export const MAP_THEME_LABELS: Record<VisualTheme, string> = {
  classic: "Classic",
  grass: "Grass",
  desert: "Desert",
  neon: "Neon",
  dark: "Dark"
};

export function resolveVisualSettings(settings?: VisualSettings): Required<VisualSettings> {
  const theme = settings?.theme ?? DEFAULT_VISUAL_SETTINGS.theme;
  const preset = MAP_THEME_PRESETS[theme] ?? DEFAULT_VISUAL_SETTINGS;

  return {
    ...DEFAULT_VISUAL_SETTINGS,
    ...preset,
    ...settings,
    theme
  };
}

export function getThemeVisualSettings(theme: VisualTheme): Required<VisualSettings> {
  return { ...MAP_THEME_PRESETS[theme] };
}
