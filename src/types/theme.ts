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

export interface SettingDefinition {
  type: string;
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
}

export interface SectionPreset {
  name: string;
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
