import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["server/**", "node_modules/**", "dist/**"],
  },
});
