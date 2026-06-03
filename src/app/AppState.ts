import type { GameMap } from "../shared/types/MapSchema";
import type { MapTemplateId } from "../shared/MapTemplates";

export type AppRoute = "menu" | "editor" | "map-list" | "play" | "profile";

export type Screen = {
  render: () => void;
  destroy?: () => void;
};

export type MainMenuActions = {
  onCreateMap: (templateId?: MapTemplateId) => void;
  onOpenMapList: () => void;
  onOpenProfile: () => void;
  onContinueLastMap: () => void;
  onContinueLastPlayed: () => void;
  onImportMap: (file: File) => void;
};

export type ProfileScreenActions = {
  onBackToMenu: () => void;
};

export type MapListActions = {
  onBackToMenu: () => void;
  onCreateMap: () => void;
  onEditMap: (map: GameMap) => void;
  onPlayMap: (map: GameMap) => void;
};

export type EditorScreenActions = {
  onBackToMenu: (map: GameMap) => void;
  onPlayMap: (map: GameMap) => void;
};

export type PlayScreenActions = {
  onBackToMenu: () => void;
  onEditMap: (map: GameMap) => void;
};
