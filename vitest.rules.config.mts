import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: "rules",
    environment: "node",
    globals: false,
    include: ["tests/rules/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    isolate: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
