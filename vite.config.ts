import { defineConfig } from "vite";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");

          if (normalizedId.includes("/node_modules/three/")) {
            return "vendor-three";
          }

          if (normalizedId.includes("/node_modules/lucide/")) {
            return "vendor-ui";
          }

          if (normalizedId.includes("/src/shared/MapTemplates")) {
            return "template-generators";
          }

          if (
            normalizedId.includes("/src/shared/") ||
            normalizedId.includes("/src/storage/LocalProfileStorage") ||
            normalizedId.includes("/src/storage/LocalMapMetadataStorage")
          ) {
            return "shared";
          }

          if (normalizedId.includes("/src/engine/")) {
            return "runtime-engine";
          }

          if (normalizedId.includes("/src/app/screens/PlayScreen")) {
            return "runtime";
          }

          if (
            normalizedId.includes("/src/editor/") ||
            normalizedId.includes("/src/app/screens/EditorScreen")
          ) {
            return "editor";
          }

          if (
            normalizedId.includes("/src/app/screens/MapListScreen") ||
            normalizedId.includes("/src/app/screens/map-list/") ||
            normalizedId.includes("/src/services/OnlineMapService") ||
            normalizedId.includes("/src/services/MultiplayerService")
          ) {
            return "online";
          }

          if (normalizedId.includes("/node_modules/")) {
            return "vendor";
          }

          return undefined;
        },
      },
    },
  },
});
