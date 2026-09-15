import type { SectionSchema, SettingDefinition } from "../types/theme";

/** A `header` / `paragraph` divider in a settings form: no id, no value. */
export interface LibrarySettingDivider {
  type: "header" | "paragraph";
  content: string;
  locales?: { en?: { content?: string }; ar?: { content?: string } };
}

/** A library section schema. Same shape as a theme schema file. */
export interface LibrarySectionSchema extends Omit<SectionSchema, "settings"> {
  settings: Array<SettingDefinition | LibrarySettingDivider>;
}
