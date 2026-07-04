import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const pkgVersion = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
).version as string;

export default defineConfig({
  entry: {
    index: "src/index.ts",
    types: "src/types/index.ts",
    normalize: "src/utils/normalize.ts",
    validation: "src/validation/index.ts",
    verify: "src/verify/index.ts",
    "v2-compat": "src/v2-compat.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  // MUST stay `true`. With multiple entries, `splitting: false` makes each
  // entry (index, v2-compat, …) bundle its OWN copy of every module it
  // imports — including `src/contexts` and its ~11 `createContext()` calls.
  // That handed `dist/v2-compat.*` a SECOND set of context objects, so
  // `useV2Products()`/`useV2Theme()` read null contexts that `NuMuProvider`
  // (in `dist/index.*`) never populated, silently breaking the whole V2→V3
  // migration shim. Splitting hoists the contexts into ONE shared chunk that
  // both entries import, so every hook resolves the SAME context instance the
  // provider fills — for esm AND cjs. The pure validation/verify/normalize
  // entries stay React-free (their shared chunk imports no React).
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  treeshake: true,
  // Inline the SDK version so the pure validation module can report it
  // without reading package.json at runtime (it gets bundled).
  define: {
    __SDK_VERSION__: JSON.stringify(pkgVersion),
  },
  // Emit `.cjs` for CommonJS and `.mjs` for ESM so the dual-package
  // exports map in package.json maps to real files.
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".mjs" };
  },
});
