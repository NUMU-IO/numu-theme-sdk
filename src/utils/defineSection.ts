/**
 * Section + block authoring helpers.
 *
 * `defineSection` and `defineBlock` bind a JSON schema to its render
 * component so theme authors don't keep two files in sync by hand.
 * The plugin ships the schema half (writes `schemas/sections/<type>.json`
 * for the customizer), the runtime imports the component half — both
 * sourced from the same factory call.
 *
 * Why factories instead of two separate files:
 *   Pre-Phase-2 layout was:
 *     theme/main.tsx        → registers components
 *     theme/schemas/sections/Hero.json → declares schema
 *   Drift was the bug. Renaming a setting required edits in two places;
 *   adding a new section meant remembering to update three lists.
 *   Factories collapse that into a single export the plugin and runtime
 *   both read.
 *
 * Usage:
 *   // sections/Hero.tsx
 *   import { defineSection } from "@numueg/theme-sdk";
 *   export default defineSection({
 *     schema: {
 *       type: "hero",
 *       name: "Hero",
 *       settings: [{ type: "text", id: "heading", label: "Heading" }],
 *       presets: [{ name: "Hero — Centered", settings: { heading: "Welcome" } }],
 *     },
 *     render: ({ settings }) => <h1>{settings.heading}</h1>,
 *   });
 *
 * The plugin's section-discovery scan picks up files under
 * `src/sections/**\/*.{tsx,ts}` whose default export is a section
 * definition. No registration list needed.
 */

import type { ComponentType } from "react";
import type {
  BlockProps,
  BlockSchema,
  SectionProps,
  SectionSchema,
} from "../types/theme";

const SECTION_MARKER = Symbol.for("numu.theme.section");
const BLOCK_MARKER = Symbol.for("numu.theme.block");

/**
 * A defined section: paired schema + render component.
 *
 * The marker symbol lets the plugin's discovery scan identify section
 * definitions without depending on a structural shape that themes might
 * accidentally collide with.
 */
export interface DefinedSection {
  schema: SectionSchema;
  render: ComponentType<SectionProps>;
  readonly [SECTION_MARKER]: true;
}

export interface DefinedBlock {
  schema: BlockSchema;
  render: ComponentType<BlockProps>;
  readonly [BLOCK_MARKER]: true;
}

export interface DefineSectionInput {
  schema: SectionSchema;
  render: ComponentType<SectionProps>;
}

export interface DefineBlockInput {
  schema: BlockSchema;
  render: ComponentType<BlockProps>;
}

/**
 * Bind a section schema to its renderer.
 *
 * Validates at runtime that `schema.type` is a stable identifier
 * (lowercase + dashes/underscores) — drift here breaks the plugin's
 * codegen step (which writes `__generated__/sections.d.ts` keyed off
 * `schema.type`).
 */
export function defineSection(input: DefineSectionInput): DefinedSection {
  if (!input?.schema?.type) {
    throw new Error(
      "defineSection: `schema.type` is required and must be a stable string id.",
    );
  }
  if (!/^[a-z][a-z0-9_-]*$/.test(input.schema.type)) {
    throw new Error(
      `defineSection: section type '${input.schema.type}' must be lowercase alphanumeric ` +
        `with dashes/underscores. The codegen step uses this as a TS key.`,
    );
  }
  if (typeof input.render !== "function") {
    throw new Error(
      "defineSection: `render` must be a React component function.",
    );
  }
  return Object.freeze({
    schema: input.schema,
    render: input.render,
    [SECTION_MARKER]: true as const,
  });
}

export function defineBlock(input: DefineBlockInput): DefinedBlock {
  if (!input?.schema?.type) {
    throw new Error("defineBlock: `schema.type` is required.");
  }
  if (!/^[a-z@][a-z0-9_/-]*$/i.test(input.schema.type)) {
    throw new Error(
      `defineBlock: block type '${input.schema.type}' has illegal chars. ` +
        `Use a-z, 0-9, dashes/underscores; @app/<slug>/<block> form is also accepted.`,
    );
  }
  if (typeof input.render !== "function") {
    throw new Error(
      "defineBlock: `render` must be a React component function.",
    );
  }
  return Object.freeze({
    schema: input.schema,
    render: input.render,
    [BLOCK_MARKER]: true as const,
  });
}

export function isDefinedSection(v: unknown): v is DefinedSection {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as Record<symbol, unknown>)[SECTION_MARKER] === true
  );
}

export function isDefinedBlock(v: unknown): v is DefinedBlock {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as Record<symbol, unknown>)[BLOCK_MARKER] === true
  );
}

/**
 * Build a section registry from a Vite glob import.
 *
 * Themes call this at the top of their `main.tsx`:
 *
 *   const sectionModules = import.meta.glob<{ default: DefinedSection }>(
 *     "./sections/*.tsx", { eager: true });
 *   const sections = collectSections(sectionModules);
 *
 * The returned object is keyed by `schema.type` for direct lookup at
 * render time. Modules whose default export isn't a DefinedSection are
 * skipped with a console warning (drops a half-migrated section without
 * breaking the rest of the bundle).
 */
export function collectSections<T extends Record<string, unknown>>(
  modules: T,
): Record<string, DefinedSection> {
  const out: Record<string, DefinedSection> = {};
  for (const [path, mod] of Object.entries(modules)) {
    const def = (mod as { default?: unknown }).default;
    if (!isDefinedSection(def)) {
      if (typeof console !== "undefined") {
        console.warn(
          `[numu] ${path}: default export is not a defineSection() result; skipped.`,
        );
      }
      continue;
    }
    if (out[def.schema.type]) {
      throw new Error(
        `[numu] duplicate section type '${def.schema.type}': ` +
          `previously defined, now also defined in ${path}.`,
      );
    }
    out[def.schema.type] = def;
  }
  return out;
}

export function collectBlocks<T extends Record<string, unknown>>(
  modules: T,
): Record<string, DefinedBlock> {
  const out: Record<string, DefinedBlock> = {};
  for (const [path, mod] of Object.entries(modules)) {
    const def = (mod as { default?: unknown }).default;
    if (!isDefinedBlock(def)) {
      if (typeof console !== "undefined") {
        console.warn(
          `[numu] ${path}: default export is not a defineBlock() result; skipped.`,
        );
      }
      continue;
    }
    if (out[def.schema.type]) {
      throw new Error(
        `[numu] duplicate block type '${def.schema.type}': ` +
          `previously defined, now also defined in ${path}.`,
      );
    }
    out[def.schema.type] = def;
  }
  return out;
}
