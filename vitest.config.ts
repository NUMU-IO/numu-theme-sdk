import { defineConfig, configDefaults } from "vitest/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The contract matchers + registry live in the sibling numu-theme-v3-tests/
// workspace. When that workspace isn't checked out (e.g. standalone CI of
// this repo), the contract-pinning suites can't load, so we skip them
// gracefully instead of failing the whole run. The unit suites that don't
// touch the workspace still run.
const harnessRoot = path.resolve(__dirname, "../numu-theme-v3-tests");
const HARNESS_PRESENT = fs.existsSync(harnessRoot);
const harnessCoupledTests = ["src/__tests__/theme-settings-v3.test.ts"];
if (!HARNESS_PRESENT) {
  console.warn(
    `[vitest] numu-theme-v3-tests workspace not found — skipping contract suites: ${harnessCoupledTests.join(", ")}`,
  );
}

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
    // Unit tests must never reach the network. applyGlobalStyleTokens
    // injects webfont <link>s; without this happy-dom tries to fetch the
    // Google-Fonts stylesheet (noisy stack traces + CI flakiness).
    environmentOptions: {
      happyDOM: {
        settings: {
          disableCSSFileLoading: true,
          disableJavaScriptFileLoading: true,
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    exclude: [
      ...configDefaults.exclude,
      ...(HARNESS_PRESENT ? [] : harnessCoupledTests),
    ],
    setupFiles: [
      // Workspace matchers (toFailContractClause / toCiteCaveat). Only
      // loaded when the sibling numu-theme-v3-tests/ workspace is checked
      // out; otherwise the contract suites above are excluded anyway.
      ...(HARNESS_PRESENT
        ? [path.resolve(harnessRoot, "tests/matchers/index.ts")]
        : []),
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
