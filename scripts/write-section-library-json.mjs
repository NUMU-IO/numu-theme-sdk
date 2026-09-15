// Writes dist/section-library.json — the library catalog the API vendors.
// Runs after tsup (see the `build` script).
import { readFileSync, writeFileSync } from "node:fs";

const { sectionLibraryCatalog } = await import("../dist/section-library.mjs");
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

writeFileSync(
  new URL("../dist/section-library.json", import.meta.url),
  JSON.stringify({ sdk_version: version, sections: sectionLibraryCatalog }, null, 2) + "\n",
);
console.log(`section-library.json: ${Object.keys(sectionLibraryCatalog).length} section(s), sdk ${version}`);
