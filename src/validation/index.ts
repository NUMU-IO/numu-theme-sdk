/**
 * Shared theme-contract validators — the single source of truth.
 *
 * This module is PURE: it imports only types (erased at compile time) and
 * has no React/DOM/fs dependencies, so the same logic runs in the CLI, the
 * Vite plugin, and (re-implemented) the backend. Callers parse JSON files
 * themselves and pass plain objects in; these functions never touch disk.
 *
 * The goal is that "builds green" implies "matches the contract": every
 * place a theme can drift from what the storefront expects is checked here
 * once, instead of being re-derived (and drifting) in each tool.
 */

import type { SectionSchema, SettingDefinition } from "../types/theme";

/**
 * The theme CONTRACT version — bumped only on a breaking change to what a
 * built theme must look like (manifest shape, required emitted artifacts,
 * section/setting semantics). The plugin stamps this into the built
 * manifest/import-map; the host refuses bundles whose contract version it
 * doesn't support. Distinct from the npm SDK version (`SDK_VERSION`), which
 * moves on every release including non-breaking ones.
 */
export const THEME_CONTRACT_VERSION = 1;

/** npm version of this SDK build (inlined by tsup `define`). Informational. */
declare const __SDK_VERSION__: string | undefined;
export const SDK_VERSION: string =
  typeof __SDK_VERSION__ === "string" ? __SDK_VERSION__ : "0.0.0";

export interface ValidationIssue {
  level: "error" | "warning";
  /** Stable machine code, e.g. "manifest.version.invalid". */
  code: string;
  message: string;
  /** Dotted path or file hint, e.g. "presets.templates.home" or "hero.json". */
  path?: string;
}

export interface ValidationResult {
  /** True when there are zero error-level issues. */
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Page templates the storefront routes to. A theme that omits a REQUIRED
 * template still works (the host falls back to its built-in), so a miss is
 * a warning, not an error — but tooling can elevate it with --strict.
 */
export const REQUIRED_TEMPLATES = [
  "home",
  "product",
  "collection",
  "cart",
  "page",
  "search",
  "404",
] as const;

export const KNOWN_TEMPLATES: ReadonlySet<string> = new Set([
  ...REQUIRED_TEMPLATES,
  "blog",
  "article",
  "policies",
  "password",
  "account",
  "checkout",
]);

/** Setting types the V3 customizer renders. Unknown types warn (forward-compat). */
export const KNOWN_SETTING_TYPES: ReadonlySet<string> = new Set([
  "text", "textarea", "richtext", "number", "range", "color", "checkbox",
  "select", "radio", "font", "image_picker", "url", "product", "product_list",
  "collection", "collection_list", "header", "paragraph", "html", "date",
  "time", "video_picker", "color_scheme", "page_picker", "blog_picker",
  "link_list_picker", "variant_picker", "file_upload", "icon_picker", "icon",
]);

/** Setting types that are presentational (no value) — `id`/`label` optional. */
const PRESENTATIONAL_SETTING_TYPES: ReadonlySet<string> = new Set([
  "header", "paragraph", "html",
]);

// ── Primitives ────────────────────────────────────────────────────

const SECTION_TYPE_RE = /^[a-z][a-z0-9_-]*$/;
const THEME_ID_RE = /^[a-z0-9][a-z0-9_-]*[a-z0-9]$/;
// Pragmatic semver (major.minor.patch + optional -prerelease / +build).
const SEMVER_RE =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

class IssueBag {
  readonly issues: ValidationIssue[] = [];
  err(code: string, message: string, path?: string) {
    this.issues.push({ level: "error", code, message, path });
  }
  warn(code: string, message: string, path?: string) {
    this.issues.push({ level: "warning", code, message, path });
  }
  result(): ValidationResult {
    return {
      valid: !this.issues.some((i) => i.level === "error"),
      issues: this.issues,
    };
  }
}

/** Pull the section types referenced by a manifest's presets. */
function collectPresetSectionTypes(manifest: Record<string, unknown>): Set<string> {
  const types = new Set<string>();
  const presets = manifest.presets;
  if (!isObject(presets)) return types;
  const buckets = [presets.templates, presets.section_groups];
  for (const bucket of buckets) {
    if (!isObject(bucket)) continue;
    for (const entry of Object.values(bucket)) {
      if (!isObject(entry)) continue;
      const sections = entry.sections;
      // sections may be an array of instances OR a map id -> instance.
      const instances = Array.isArray(sections)
        ? sections
        : isObject(sections)
          ? Object.values(sections)
          : [];
      for (const inst of instances) {
        if (isObject(inst) && isNonEmptyString(inst.type)) types.add(inst.type);
      }
    }
  }
  return types;
}

// ── Setting / schema validation ───────────────────────────────────

function validateSettingInto(
  bag: IssueBag,
  setting: unknown,
  pathPrefix: string,
  seenIds: Set<string>,
) {
  if (!isObject(setting)) {
    bag.err("schema.setting.invalid", "Setting must be an object.", pathPrefix);
    return;
  }
  const type = setting.type;
  if (!isNonEmptyString(type)) {
    bag.err("schema.setting.type.missing", "Setting is missing a `type`.", pathPrefix);
  } else if (!KNOWN_SETTING_TYPES.has(type)) {
    bag.warn(
      "schema.setting.type.unknown",
      `Unknown setting type "${type}" — the customizer will fall back to a text input.`,
      pathPrefix,
    );
  }
  const presentational =
    isNonEmptyString(type) && PRESENTATIONAL_SETTING_TYPES.has(type);
  if (!presentational) {
    if (!isNonEmptyString(setting.id)) {
      bag.err("schema.setting.id.missing", "Setting is missing an `id`.", pathPrefix);
    } else {
      if (seenIds.has(setting.id)) {
        bag.err(
          "schema.setting.id.duplicate",
          `Duplicate setting id "${setting.id}".`,
          pathPrefix,
        );
      }
      seenIds.add(setting.id);
    }
    if (!isNonEmptyString(setting.label)) {
      bag.warn("schema.setting.label.missing", "Setting has no `label`.", pathPrefix);
    }
  }
  // select / radio need options.
  if (type === "select" || type === "radio") {
    const options = setting.options;
    if (!Array.isArray(options) || options.length === 0) {
      bag.err(
        "schema.setting.options.missing",
        `"${type}" setting "${String(setting.id)}" must declare a non-empty \`options\` array.`,
        pathPrefix,
      );
    }
  }
  // range needs bounds.
  if (type === "range") {
    if (typeof setting.min !== "number" || typeof setting.max !== "number") {
      bag.err(
        "schema.setting.range.bounds",
        `"range" setting "${String(setting.id)}" must declare numeric \`min\` and \`max\`.`,
        pathPrefix,
      );
    } else if (setting.min >= setting.max) {
      bag.err(
        "schema.setting.range.order",
        `"range" setting "${String(setting.id)}" has min >= max.`,
        pathPrefix,
      );
    }
  }
}

/**
 * Validate one section schema (the parsed schemas/sections/<type>.json).
 * When `filenameType` is given, enforces the component-filename = schema-type
 * convention by requiring `schema.type` to equal it.
 */
export function validateSectionSchema(
  schema: unknown,
  opts: { filenameType?: string } = {},
): ValidationResult {
  const bag = new IssueBag();
  const where = opts.filenameType ? `${opts.filenameType}.json` : "section schema";
  if (!isObject(schema)) {
    bag.err("schema.invalid", "Section schema must be a JSON object.", where);
    return bag.result();
  }
  const type = schema.type;
  if (!isNonEmptyString(type)) {
    bag.err("schema.type.missing", "Section schema is missing a `type`.", where);
  } else {
    if (!SECTION_TYPE_RE.test(type)) {
      bag.err(
        "schema.type.format",
        `Section type "${type}" must match ${SECTION_TYPE_RE} (lowercase, start with a letter).`,
        where,
      );
    }
    if (opts.filenameType && type !== opts.filenameType) {
      bag.err(
        "schema.type.filename_mismatch",
        `Schema type "${type}" must equal its filename "${opts.filenameType}" (component-filename = schema-type convention).`,
        where,
      );
    }
  }
  if (!isNonEmptyString(schema.name)) {
    bag.err("schema.name.missing", "Section schema is missing a `name`.", where);
  }
  if (schema.settings === undefined) {
    bag.warn("schema.settings.missing", "Section schema has no `settings`.", where);
  } else if (!Array.isArray(schema.settings)) {
    bag.err("schema.settings.invalid", "`settings` must be an array.", where);
  } else {
    const seen = new Set<string>();
    schema.settings.forEach((s, i) =>
      validateSettingInto(bag, s, `${where}.settings[${i}]`, seen),
    );
  }
  // Nested block schemas (shallow — type + settings shape).
  if (schema.blocks !== undefined) {
    if (!Array.isArray(schema.blocks)) {
      bag.err("schema.blocks.invalid", "`blocks` must be an array.", where);
    } else {
      schema.blocks.forEach((b, i) => {
        if (!isObject(b) || !isNonEmptyString(b.type)) {
          bag.err("schema.block.type.missing", `Block[${i}] is missing a \`type\`.`, where);
          return;
        }
        if (!SECTION_TYPE_RE.test(b.type)) {
          bag.err(
            "schema.block.type.format",
            `Block type "${b.type}" must match ${SECTION_TYPE_RE}.`,
            where,
          );
        }
        if (Array.isArray(b.settings)) {
          const seen = new Set<string>();
          b.settings.forEach((s, j) =>
            validateSettingInto(bag, s, `${where}.blocks[${i}].settings[${j}]`, seen),
          );
        }
      });
    }
  }
  return bag.result();
}

/**
 * Instance conformance: check a settings object (from a preset or a merchant
 * customization) against its section schema. Unknown keys warn (harmless at
 * runtime — ignored); invalid values (bad select option, out-of-range,
 * wrong primitive) error.
 */
export function validateSettingsAgainstSchema(
  settings: unknown,
  schema: Pick<SectionSchema, "settings" | "type">,
  pathPrefix = "settings",
): ValidationResult {
  const bag = new IssueBag();
  if (!isObject(settings)) {
    bag.err("instance.settings.invalid", "Section settings must be an object.", pathPrefix);
    return bag.result();
  }
  const defs = Array.isArray(schema.settings) ? schema.settings : [];
  const byId = new Map<string, SettingDefinition>();
  for (const d of defs) if (isNonEmptyString(d?.id)) byId.set(d.id, d);

  for (const [key, value] of Object.entries(settings)) {
    const def = byId.get(key);
    if (!def) {
      bag.warn(
        "instance.setting.unknown",
        `Setting "${key}" is not declared in the "${String(schema.type)}" schema.`,
        `${pathPrefix}.${key}`,
      );
      continue;
    }
    if (value === null || value === undefined) continue;
    const p = `${pathPrefix}.${key}`;
    if ((def.type === "select" || def.type === "radio") && Array.isArray(def.options)) {
      const allowed = def.options.map((o) => o.value);
      if (typeof value === "string" && !allowed.includes(value)) {
        bag.err(
          "instance.setting.option.invalid",
          `"${key}" = "${value}" is not one of: ${allowed.join(", ")}.`,
          p,
        );
      }
    }
    if (def.type === "range" && typeof value === "number") {
      if (typeof def.min === "number" && value < def.min) {
        bag.err("instance.setting.range.under", `"${key}" = ${value} is below min ${def.min}.`, p);
      }
      if (typeof def.max === "number" && value > def.max) {
        bag.err("instance.setting.range.over", `"${key}" = ${value} is above max ${def.max}.`, p);
      }
    }
    if ((def.type === "checkbox") && typeof value !== "boolean") {
      bag.warn("instance.setting.type.mismatch", `"${key}" should be a boolean.`, p);
    }
    if ((def.type === "number" || def.type === "range") && typeof value !== "number") {
      bag.warn("instance.setting.type.mismatch", `"${key}" should be a number.`, p);
    }
  }
  return bag.result();
}

// ── Manifest validation ───────────────────────────────────────────

/** Core manifest field checks shared by source (theme.json) and built manifests. */
function validateManifestCore(bag: IssueBag, m: Record<string, unknown>) {
  if (!isNonEmptyString(m.id)) {
    bag.err("manifest.id.missing", "theme.json is missing `id`.", "id");
  } else if (!THEME_ID_RE.test(m.id)) {
    bag.err(
      "manifest.id.format",
      `Theme id "${m.id}" must be lowercase alphanumeric with dashes/underscores (no leading/trailing separator).`,
      "id",
    );
  }
  // name: string or bilingual object { en|default, ... }.
  const name = m.name;
  const nameOk =
    isNonEmptyString(name) ||
    (isObject(name) && Object.values(name).some((v) => isNonEmptyString(v)));
  if (!nameOk) {
    bag.err("manifest.name.missing", "theme.json is missing a non-empty `name`.", "name");
  }
  if (!isNonEmptyString(m.version)) {
    bag.err("manifest.version.missing", "theme.json is missing `version`.", "version");
  } else if (!SEMVER_RE.test(m.version)) {
    bag.err("manifest.version.invalid", `Version "${m.version}" is not valid semver.`, "version");
  }
  if (!isNonEmptyString(m.author)) {
    bag.err("manifest.author.missing", "theme.json is missing `author`.", "author");
  }
  if (m.min_sdk_version !== undefined && !SEMVER_RE.test(String(m.min_sdk_version))) {
    bag.warn("manifest.min_sdk_version.invalid", "`min_sdk_version` is not valid semver.", "min_sdk_version");
  }
}

/**
 * Validate a source theme manifest (parsed theme.json).
 *
 * `ctx.sectionTypes` — the set of section types the theme actually ships
 * (from schemas/sections/*.json). When provided, every section type
 * referenced by a preset must be present, and missing required templates
 * are surfaced as warnings.
 */
export function validateManifest(
  manifest: unknown,
  ctx: { sectionTypes?: ReadonlySet<string> } = {},
): ValidationResult {
  const bag = new IssueBag();
  if (!isObject(manifest)) {
    bag.err("manifest.invalid", "theme.json must be a JSON object.", "theme.json");
    return bag.result();
  }
  validateManifestCore(bag, manifest);

  const presets = manifest.presets;
  if (!isObject(presets) || Object.keys(presets).length === 0) {
    bag.warn("manifest.presets.empty", "theme.json has no presets — merchants start with an empty page.", "presets");
  } else {
    // Every referenced section type must resolve to a shipped schema.
    if (ctx.sectionTypes) {
      for (const type of collectPresetSectionTypes(manifest)) {
        if (!ctx.sectionTypes.has(type)) {
          bag.err(
            "manifest.preset.unknown_section",
            `Preset references section type "${type}" with no schemas/sections/${type}.json.`,
            "presets",
          );
        }
      }
    }
    // Required-template coverage (warning).
    const templates = isObject(presets.templates) ? presets.templates : {};
    for (const t of REQUIRED_TEMPLATES) {
      if (!(t in templates)) {
        bag.warn(
          "manifest.template.missing",
          `No preset for required template "${t}" — the storefront will fall back to its built-in.`,
          `presets.templates.${t}`,
        );
      }
    }
  }
  return bag.result();
}

/**
 * Server-side gate: validate the artifacts the plugin emits — dist/manifest.json
 * (the embedded built manifest, including section_schemas) and dist/import-map.json
 * (the federation + contract-version descriptor). This is what the backend should
 * run on upload/submit, since it can't run the source build.
 *
 * `opts.hostContractVersion` — when given, refuses bundles whose
 * `contract_version` the host doesn't support.
 */
export function validateBuiltManifest(
  builtManifest: unknown,
  importMap?: unknown,
  opts: { hostContractVersion?: number } = {},
): ValidationResult {
  const bag = new IssueBag();
  if (!isObject(builtManifest)) {
    bag.err("built.invalid", "manifest.json must be a JSON object.", "manifest.json");
    return bag.result();
  }
  validateManifestCore(bag, builtManifest);

  // section_schemas must cover every type the presets reference.
  const schemas = builtManifest.section_schemas;
  const shipped = new Set<string>(isObject(schemas) ? Object.keys(schemas) : []);
  if (!isObject(schemas)) {
    bag.warn("built.section_schemas.missing", "manifest.json has no `section_schemas`.", "section_schemas");
  }
  for (const type of collectPresetSectionTypes(builtManifest)) {
    if (!shipped.has(type)) {
      bag.err(
        "built.preset.unknown_section",
        `Preset references section type "${type}" not present in section_schemas.`,
        "presets",
      );
    }
  }
  // Each shipped schema must itself be valid.
  if (isObject(schemas)) {
    for (const [type, schema] of Object.entries(schemas)) {
      const r = validateSectionSchema(schema, { filenameType: type });
      for (const issue of r.issues) bag.issues.push(issue);
    }
  }
  if (!isNonEmptyString(builtManifest.plugin_version)) {
    bag.warn("built.plugin_version.missing", "manifest.json has no `plugin_version`.", "plugin_version");
  }

  // Contract-version compatibility from the import map.
  if (importMap !== undefined) {
    if (!isObject(importMap)) {
      bag.err("importmap.invalid", "import-map.json must be a JSON object.", "import-map.json");
    } else {
      const cv = importMap.contract_version;
      if (typeof cv !== "number") {
        bag.warn(
          "importmap.contract_version.missing",
          "import-map.json has no numeric `contract_version` — built by an older plugin.",
          "contract_version",
        );
      } else if (
        typeof opts.hostContractVersion === "number" &&
        cv > opts.hostContractVersion
      ) {
        bag.err(
          "importmap.contract_version.incompatible",
          `Theme built for contract v${cv}; this platform supports up to v${opts.hostContractVersion}.`,
          "contract_version",
        );
      }
    }
  }
  return bag.result();
}

/** Convenience: merge several results into one. */
export function mergeResults(...results: ValidationResult[]): ValidationResult {
  const issues = results.flatMap((r) => r.issues);
  return { valid: !issues.some((i) => i.level === "error"), issues };
}
