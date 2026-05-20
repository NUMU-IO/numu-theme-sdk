import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Vite's default fs.allow blocks reads outside the project root. The
  // workspace matchers live in the sibling numu-theme-v3-tests/ repo, so
  // we need to widen the boundary to the shared parent directory.
  server: {
    fs: {
      allow: [path.resolve(__dirname, ".."), __dirname],
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    setupFiles: [
      // Workspace matchers (toFailContractClause / toCiteCaveat). Will
      // skip gracefully if the workspace isn't checked out — see the
      // matchers file for the standalone-friendly load path.
      path.resolve(__dirname, "../numu-theme-v3-tests/tests/matchers/index.ts"),
    ],
  },
  resolve: {
    alias: {
      "@numueg/theme-sdk": path.resolve(__dirname, "src/index.ts"),
      "@numueg/theme-sdk/types": path.resolve(__dirname, "src/types/index.ts"),
      "@numueg/theme-sdk/normalize": path.resolve(__dirname, "src/utils/normalize.ts"),
    },
  },
});
