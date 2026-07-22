/**
 * Template + section-group resolution — the "no blank page" engine.
 *
 * This is engine policy, not theme code, and it was copy-pasted into every
 * theme: `src/sections/_template-utils.ts` is BYTE-IDENTICAL across 11 of the
 * 14 themes that carry it (md5 59608dd4f4a702136854d7aaf33ba5e3); the
 * remaining copies differ only in comments and brace style. The file's own
 * header instructed theme authors to copy it and said it could be deleted
 * "once the published SDK ships its own sanitizeTemplate". This is that.
 *
 * Why centralising it is safe — and why it matters:
 *   - It contains ZERO design. It decides WHICH sections render, never how
 *     they look, so it cannot homogenise themes.
 *   - Getting it subtly wrong renders an EMPTY STORE. Empire re-implemented a
 *     weaker version inline with no unknown-type filtering, so a stale
 *     customisation renders "Unknown section" placeholders there while every
 *     other theme degrades gracefully. One implementation removes that class.
 *
 * The two rules it encodes, both learned from real blank-page incidents:
 *   1. A template may arrive as an ARRAY or as a MAP + `order[]`. The
 *      customizer writes one shape, theme presets use the other.
 *   2. Host customisation wins over the theme's bundled preset — UNLESS it
 *      resolves to nothing this theme can render, in which case fall back to
 *      the preset rather than showing the shopper an empty page.
 */

import type { SectionInstance } from "../types/theme";

/** A template or section group, in either of the two shapes hosts send. */
export interface MaybeOrderedTemplate {
  name?: string;
  sections?: Record<string, SectionInstance> | SectionInstance[];
  order?: string[];
}

/** A section instance paired with the stable id the customizer selects by. */
export interface ResolvedSection {
  id: string;
  instance: SectionInstance;
}

/**
 * Normalise a template/group into an ordered list.
 *
 * Array form gets synthetic `${type}-${index}` ids (presets have no ids of
 * their own). Map form is walked in `order`, skipping ids the map doesn't
 * contain — a dangling id in `order` is a customisation that referenced a
 * deleted section and must not throw.
 */
export function resolveSections(
  group: MaybeOrderedTemplate | undefined,
): ResolvedSection[] {
  if (!group) return [];
  if (Array.isArray(group.sections)) {
    return group.sections.map((instance, idx) => ({
      id: `${instance.type}-${idx}`,
      instance,
    }));
  }
  const map = (group.sections ?? {}) as Record<string, SectionInstance>;
  const order = group.order ?? Object.keys(map);
  const out: ResolvedSection[] = [];
  for (const id of order) {
    const instance = map[id];
    if (instance) out.push({ id, instance });
  }
  return out;
}

/**
 * Choose between the host's customisation and the theme's bundled preset,
 * then drop section types this theme cannot render.
 *
 * `isKnown` is the theme's own registry lookup — the one thing that genuinely
 * belongs to the theme, so it stays a parameter.
 *
 * The order of the three checks is load-bearing:
 *   - nothing from the host        → preset (a fresh install renders its demo)
 *   - host sections, none known    → preset (a customisation built for a
 *                                    DIFFERENT theme must not blank the page)
 *   - otherwise                    → host sections, unknown types filtered out
 */
export function selectTemplateSections(
  hostTemplate: MaybeOrderedTemplate | undefined,
  builtinTemplate: MaybeOrderedTemplate | undefined,
  isKnown: (sectionType: string) => boolean,
): ResolvedSection[] {
  const hostSections = resolveSections(hostTemplate);
  if (hostSections.length === 0) {
    return resolveSections(builtinTemplate);
  }
  const anyKnown = hostSections.some(({ instance }) => isKnown(instance.type));
  if (!anyKnown) return resolveSections(builtinTemplate);
  return hostSections.filter(({ instance }) => isKnown(instance.type));
}
