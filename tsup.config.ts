import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    types: "src/types/index.ts",
    normalize: "src/utils/normalize.ts",
    "v2-compat": "src/v2-compat.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  treeshake: true,
  // Emit `.cjs` for CommonJS and `.mjs` for ESM so the dual-package
  // exports map in package.json maps to real files.
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".mjs" };
  },
});
