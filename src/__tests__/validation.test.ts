import { describe, it, expect } from "vitest";
import {
  THEME_CONTRACT_VERSION,
  REQUIRED_TEMPLATES,
  validateManifest,
  validateSectionSchema,
  validateSettingsAgainstSchema,
  validateBuiltManifest,
} from "../validation";

const codes = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code);

describe("validateSectionSchema", () => {
  it("accepts a well-formed schema", () => {
    const r = validateSectionSchema(
      {
        type: "hero",
        name: "Hero",
        settings: [
          { type: "text", id: "headline", label: "Headline" },
          { type: "select", id: "layout", label: "Layout", options: [{ value: "a", label: "A" }] },
          { type: "range", id: "pad", label: "Pad", min: 0, max: 10 },
        ],
      },
      { filenameType: "hero" },
    );
    expect(r.valid).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("rejects a bad type format", () => {
    const r = validateSectionSchema({ type: "Hero", name: "Hero", settings: [] });
    expect(r.valid).toBe(false);
    expect(codes(r)).toContain("schema.type.format");
  });

  it("enforces filename = type", () => {
    const r = validateSectionSchema({ type: "hero", name: "H", settings: [] }, { filenameType: "promo" });
    expect(codes(r)).toContain("schema.type.filename_mismatch");
  });

  it("requires options for select and bounds for range", () => {
    const r = validateSectionSchema({
      type: "x",
      name: "X",
      settings: [
        { type: "select", id: "a", label: "A" },
        { type: "range", id: "b", label: "B" },
      ],
    });
    expect(codes(r)).toContain("schema.setting.options.missing");
    expect(codes(r)).toContain("schema.setting.range.bounds");
  });

  it("flags duplicate setting ids", () => {
    const r = validateSectionSchema({
      type: "x",
      name: "X",
      settings: [
        { type: "text", id: "a", label: "A" },
        { type: "text", id: "a", label: "A2" },
      ],
    });
    expect(codes(r)).toContain("schema.setting.id.duplicate");
  });
});

describe("validateManifest", () => {
  const base = {
    id: "my-theme",
    name: "My Theme",
    version: "1.0.0",
    author: "Me <me@example.com>",
    presets: { templates: Object.fromEntries(REQUIRED_TEMPLATES.map((t) => [t, { sections: [] }])) },
  };

  it("accepts a valid manifest", () => {
    expect(validateManifest(base).valid).toBe(true);
  });

  it("rejects bad id and version", () => {
    const r = validateManifest({ ...base, id: "-bad-", version: "1.0" });
    expect(r.valid).toBe(false);
    expect(codes(r)).toEqual(expect.arrayContaining(["manifest.id.format", "manifest.version.invalid"]));
  });

  it("accepts a bilingual name object", () => {
    const r = validateManifest({ ...base, name: { en: "Hi", ar: "مرحبا" } });
    expect(r.valid).toBe(true);
  });

  it("errors when a preset references an unshipped section type", () => {
    const r = validateManifest(
      { ...base, presets: { templates: { home: { sections: [{ type: "ghost", settings: {} }] } } } },
      { sectionTypes: new Set(["hero"]) },
    );
    expect(codes(r)).toContain("manifest.preset.unknown_section");
  });

  it("warns (not errors) on missing required templates", () => {
    const r = validateManifest({ ...base, presets: { templates: { home: { sections: [] } } } });
    expect(r.valid).toBe(true);
    expect(codes(r)).toContain("manifest.template.missing");
  });
});

describe("validateSettingsAgainstSchema", () => {
  const schema = {
    type: "hero",
    settings: [
      { type: "select", id: "layout", label: "L", options: [{ value: "a", label: "A" }] },
      { type: "range", id: "pad", label: "P", min: 0, max: 10 },
    ],
  };

  it("errors on invalid option value and out-of-range", () => {
    const r = validateSettingsAgainstSchema({ layout: "z", pad: 99 }, schema);
    expect(codes(r)).toEqual(
      expect.arrayContaining(["instance.setting.option.invalid", "instance.setting.range.over"]),
    );
  });

  it("warns on unknown setting key", () => {
    const r = validateSettingsAgainstSchema({ nope: 1 }, schema);
    expect(r.valid).toBe(true);
    expect(codes(r)).toContain("instance.setting.unknown");
  });
});

describe("validateBuiltManifest", () => {
  const built = {
    id: "my-theme",
    name: "My Theme",
    version: "1.0.0",
    author: "Me",
    plugin_version: "0.3.0",
    presets: { templates: { home: { sections: [{ type: "hero", settings: {} }] } } },
    section_schemas: { hero: { type: "hero", name: "Hero", settings: [] } },
  };

  it("accepts a coherent built manifest + import map", () => {
    const r = validateBuiltManifest(built, { contract_version: THEME_CONTRACT_VERSION }, {
      hostContractVersion: THEME_CONTRACT_VERSION,
    });
    expect(r.valid).toBe(true);
  });

  it("errors when a preset type is missing from section_schemas", () => {
    const r = validateBuiltManifest(
      { ...built, section_schemas: {} },
      { contract_version: THEME_CONTRACT_VERSION },
    );
    expect(codes(r)).toContain("built.preset.unknown_section");
  });

  it("refuses a future contract version", () => {
    const r = validateBuiltManifest(built, { contract_version: THEME_CONTRACT_VERSION + 1 }, {
      hostContractVersion: THEME_CONTRACT_VERSION,
    });
    expect(r.valid).toBe(false);
    expect(codes(r)).toContain("importmap.contract_version.incompatible");
  });
});
