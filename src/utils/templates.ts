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

/**
 * Find the theme's header/footer for a route it has no template for.
 *
 * Chrome reaches a theme from `section_groups` — except most themes never used
 * that channel: they put the header and footer INLINE in each template's own
 * section list. That works right up until the shopper hits a route the theme
 * ships no template for. Then there are no sections, so there is no chrome,
 * and the page renders with no navigation and no way back into the store.
 *
 * That is what `/blogs` looked like on every theme: correct, readable content
 * with nothing around it — no logo, no menu, no cart, no footer. A shopper
 * arriving from search had to press Back to escape.
 *
 * The template's OWN inline chrome still wins when it has some. This only
 * supplies chrome to routes that would otherwise have none, by borrowing the
 * chrome the theme already renders everywhere else — `home` first, since it is
 * the one template every theme ships and the one merchants customise.
 *
 * Returns `[]` when the theme genuinely has no chrome of this kind anywhere,
 * so a caller can still fall back to its own default.
 */
export function selectChromeSections(options: {
  /** `section_groups[kind]` from the host — the customizer's channel. */
  hostGroup?: MaybeOrderedTemplate;
  /** The theme's own preset `section_groups[kind]`. */
  presetGroup?: MaybeOrderedTemplate;
  /** Chrome found inline in the CURRENT template's section list. */
  inline?: ResolvedSection[];
  /** Every template the theme can draw on — host customisation and presets. */
  templates?: Array<MaybeOrderedTemplate | undefined>;
  /** True for the section types that count as this kind of chrome. */
  isChrome: (sectionType: string) => boolean;
  /** The theme's registry lookup. */
  isKnown: (sectionType: string) => boolean;
}): ResolvedSection[] {
  const { hostGroup, presetGroup, inline, templates, isChrome, isKnown } =
    options;
  const known = (list: ResolvedSection[]) =>
    list.filter(({ instance }) => isKnown(instance.type));

  const fromHost = known(resolveSections(hostGroup));
  if (fromHost.length > 0) return fromHost;

  if (inline && inline.length > 0) return known(inline);

  const fromPreset = known(resolveSections(presetGroup));
  if (fromPreset.length > 0) return fromPreset;

  // Last resort: borrow from any template that carries this chrome inline.
  for (const template of templates ?? []) {
    const borrowed = known(resolveSections(template)).filter(({ instance }) =>
      isChrome(instance.type),
    );
    if (borrowed.length > 0) return borrowed;
  }
  return [];
}
