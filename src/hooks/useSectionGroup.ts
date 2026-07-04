"use client";

import { useContext, useMemo } from "react";
import { ThemeSettingsContext } from "../contexts";
import type { SectionInstance } from "../types/theme";

/**
 * A section instance from a section group, carrying its own `id` (the key it
 * had inside the group's `sections` map). The raw `SectionInstance` drops the
 * id — but a theme needs it to key its React list, wire `<Section id={…}>`
 * click-to-select, and look the type up in its own registry — so
 * `useSectionGroup` re-attaches it here.
 */
export interface SectionGroupInstance extends SectionInstance {
  /** The instance's key within the group's `sections` map. */
  id: string;
}

const EMPTY: readonly SectionGroupInstance[] = Object.freeze([]);

/**
 * useSectionGroup — read the ordered section instances for a named section
 * group ("header", "footer", or any custom global group) out of
 * `themeSettings.section_groups[group]`.
 *
 * This is the SDK side of "global sections shared across pages": the host
 * ships one `section_groups` map on every page, and a theme renders a given
 * group in its layout (header/footer) or wherever it wants a page-independent
 * section list. The returned array is in the group's `order`, and each entry
 * carries its `id` so the theme can key + select + dispatch on it:
 *
 * ```tsx
 * const headerSections = useSectionGroup("header");
 * return headerSections.map(({ id, type, settings }) => {
 *   const Comp = registry[type]?.render;      // theme owns the registry
 *   return Comp ? (
 *     <Section key={id} id={id} type={type} groupId="header">
 *       <Comp settings={settings} />
 *     </Section>
 *   ) : null;
 * });
 * ```
 *
 * Pure data hook — it does NOT map types to components. The SDK has no section
 * registry (a theme builds its own via `collectSections`), so there is no
 * generic `<GlobalSections>` renderer to ship: the theme walks the returned
 * instances through its own registry, exactly as it already does for template
 * sections. Returns `[]` (a stable reference) when there is no provider, no
 * `section_groups`, the named group is absent, or its `order` is empty.
 *
 * Disabled instances are INCLUDED (a `disabled` flag is preserved on each
 * entry); filter with `.filter((s) => !s.disabled)` if the theme hides them.
 * Ids listed in `order` but missing from `sections` are skipped defensively.
 */
export function useSectionGroup(group: string): SectionGroupInstance[] {
  const settings = useContext(ThemeSettingsContext);
  return useMemo(() => {
    const grp = settings?.section_groups?.[group];
    if (!grp || !Array.isArray(grp.order) || grp.order.length === 0) {
      return EMPTY as SectionGroupInstance[];
    }
    const sections = grp.sections ?? {};
    const out: SectionGroupInstance[] = [];
    for (const id of grp.order) {
      const instance = sections[id];
      if (!instance) continue; // order references a removed section — skip.
      out.push({ id, ...instance });
    }
    return out;
  }, [settings, group]);
}
