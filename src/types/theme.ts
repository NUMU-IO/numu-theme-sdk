/** V3 Theme Settings — the canonical data shape */
export interface ThemeSettingsV3 {
  schema_version: 3;
  theme_id: string;
  global_settings: Record<string, any>;
  templates: Record<string, PageTemplate>;
  section_groups: Record<string, SectionGroup>;
  external_theme?: ExternalThemeMetadata | null;
}

export interface PageTemplate {
  name: string;
  sections: Record<string, SectionInstance>;
  order: string[];
}

export interface SectionGroup {
  name: string;
  sections: Record<string, SectionInstance>;
  order: string[];
}

export interface SectionInstance {
  type: string;
  settings: Record<string, any>;
  disabled?: boolean;
  blocks?: Record<string, BlockInstance>;
  block_order?: string[];
}

export interface BlockInstance {
  type: string;
  settings: Record<string, any>;
  disabled?: boolean;
}

export interface ExternalThemeMetadata {
  bundle_url: string;
  css_url?: string | null;
  mode?: string;
  settings_schema?: Record<string, any> | null;
  section_schemas?: Record<string, any> | null;
}

/**
 * Live mount handle returned by a V3 theme bundle's `mount(el, ctx)`.
 *
 * Two shapes accepted by the host:
 *
 *   1. **Legacy** — `mount(el, ctx): () => void`
 *      The bundle returns only a cleanup function. Every host-side
 *      themeSettings change forces a full unmount + remount, which is
 *      expensive but always correct. Hosts must keep supporting this
 *      for older bundles built against pre-0.2 SDK versions.
 *
 *   2. **Wave 3+** — `mount(el, ctx): MountResult`
 *      The bundle returns an object with `cleanup` + an `applyDraft`
 *      method that takes a fresh `ThemeSettingsV3` and re-renders the
 *      bundle's React tree in-place (no createRoot churn). This is the
 *      fast path used by the customizer's live preview — a keystroke
 *      in the dashboard becomes a single React reconciliation in the
 *      iframe, typically < 16 ms.
 *
 * Hosts feature-detect by checking `typeof handle === "function"`
 * (legacy) vs `typeof handle === "object" && handle.cleanup`
 * (Wave 3+). Theme authors should prefer the MountResult shape — the
 * `numuTheme` plugin's typings will flag the missing applyDraft once
 * the editor's live-preview path requires it.
 */
export interface MountResult {
  /** Unmount the bundle's React tree and release any resources. */
  cleanup: () => void;
  /**
   * Apply a fresh draft (e.g. from the customizer iframe's
   * `numu:theme:update` postMessage) without tearing down the tree.
   * Implementations typically forward the value to a useState setter
   * inside a wrapper that renders `<NuMuProvider themeSettings={...}>`.
   *
   * Safe to call repeatedly; the bundle is expected to dedup
   * reference-equal calls on its own. Returns nothing — selection /
   * navigation echo back via postMessage.
   */
  applyDraft: (next: ThemeSettingsV3) => void;
}

/** Section schema for customizer form generation */
export interface SectionSchema {
  type: string;
  name: string;
  name_ar?: string;
  tag?: string;
  class?: string;
  limit?: number;
  settings: SettingDefinition[];
  blocks?: BlockSchema[];
  max_blocks?: number;
  presets?: SectionPreset[];
}

export interface BlockSchema {
  type: string;
  name: string;
  name_ar?: string;
  limit?: number;
  settings: SettingDefinition[];
}

/**
 * Setting types the V3 customizer renders. Themes can declare any
 * string here; unknown types fall through to a plain text input. The
 * union below documents the canonical set so theme authors get
 * autocomplete and TypeScript errors on typos.
 */
export type SettingType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "range"
  | "color"
  | "checkbox"
  | "select"
  | "radio"
  | "font"
  | "image_picker"
  | "url"
  | "product"
  | "product_list"
  | "collection"
  | "collection_list"
  | "header"
  | "paragraph"
  | "html"
  | "date"
  | "time"
  | "video_picker"
  | "color_scheme"
  | "page_picker"
  | "blog_picker"
  | "link_list_picker"
  | "variant_picker"
  | "file_upload";

/**
 * `visible_if` — conditional visibility expression evaluated against
 * sibling settings in the same schema. Two flavors:
 *
 *   - String DSL: `"settings.show_button == true && settings.layout != 'minimal'"`
 *   - Object form: `{ show_button: true, layout: ["full", "split"] }`
 *
 * Evaluator lives in the merchant hub: any setting whose expression is
 * falsy is skipped from the rendered form.
 */
export type VisibleIf = string | Record<string, unknown>;

export interface SettingDefinition {
  type: SettingType | (string & {}); // unions stay open for forward-compat
  id: string;
  label: string;
  label_ar?: string;
  default?: any;
  info?: string;
  info_ar?: string;
  placeholder?: string;
  options?: { value: string; label: string; label_ar?: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Hide this setting unless the expression evaluates truthy. */
  visible_if?: VisibleIf;
}

export interface SectionPreset {
  name: string;
  /** Localized names so the Add Section dialog reads in the editor's
   * current locale. Falls back to `name` when the locale is missing. */
  locales?: {
    en?: { name?: string };
    ar?: { name?: string };
  };
  settings?: Record<string, any>;
  blocks?: { type: string; settings?: Record<string, any> }[];
}

/** Section component props */
export interface SectionProps {
  settings: Record<string, any>;
  blocks?: Record<string, BlockInstance>;
  blockOrder?: string[];
  storeData?: any;
}

/** Block component props */
export interface BlockProps {
  settings: Record<string, any>;
}
