/**
 * T055 — sdk/theme-settings-v3-schema-version-pinned.
 *
 * ThemeSettingsV3.schema_version is a literal `3` — pinning ensures
 * any V4 migration ships under a NEW interface name, so a partially
 * upgraded host doesn't silently treat V4 data as V3.
 */

import { describe, it, expect } from "vitest";
import type { ThemeSettingsV3 } from "../types/theme";
import { resolveThemeSettings } from "../utils/normalize";
import { SDK_THEME_SETTINGS_V3_SCHEMA_VERSION_PINNED } from "../../../numu-theme-v3-tests/tests/contract-registry";

describe("sdk/theme-settings-v3-schema-version-pinned", () => {
  it("positive: a V3 value with schema_version=3 round-trips through resolveThemeSettings", () => {
    const v3: ThemeSettingsV3 = {
      schema_version: 3,
      theme_id: "fixture",
      global_settings: {},
      templates: {},
      section_groups: {},
    };
    const out = resolveThemeSettings(v3);
    expect(out.schema_version).toBe(3);
  });

  it("negative: assigning schema_version=4 is a TYPE error (this test asserts the type-level guard exists)", () => {
    // The line below is intentionally commented out — uncommenting it
    // MUST cause `tsc --noEmit` to fail. We assert the runtime literal
    // value as a smoke check that the type was not relaxed to `number`.
    //
    //   const _bad: ThemeSettingsV3 = { ...validV3, schema_version: 4 };
    //
    // Runtime check: a fresh V3 object's schema_version stays the
    // literal 3 (not coerced).
    const v3: ThemeSettingsV3 = {
      schema_version: 3,
      theme_id: "fixture",
      global_settings: {},
      templates: {},
      section_groups: {},
    };
    const isPinned: 3 = v3.schema_version;
    expect(isPinned).toFailContractClause(
      SDK_THEME_SETTINGS_V3_SCHEMA_VERSION_PINNED.id,
      {
        observed: typeof isPinned + "=" + isPinned,
        expected: "literal 3 (number-narrowed type, not widened to number)",
      },
    );
    expect(v3.schema_version).toBe(3);
  });
});
