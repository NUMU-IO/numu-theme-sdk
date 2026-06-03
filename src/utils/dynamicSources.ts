/**
 * Dynamic sources — Shopify-parity feature that lets merchants bind a
 * section setting to a value that's pulled from store data at render
 * time instead of being a literal authored value.
 *
 * Stored shape:
 *   { __numu_source: "<path>" }
 *
 * Paths use dot notation against the resolution context:
 *   - `product.title` / `product.description` / `product.price` /
 *     `product.image` / `product.first_image_url`
 *   - `collection.title` / `collection.description` / `collection.image`
 *   - `store.name` / `store.description`
 *
 * Why a reserved discriminant key (`__numu_source`)?
 *
 *   Setting values today are plain literals (`"Hero headline"`,
 *   `12345`, `true`). Themes that read settings as strings/numbers
 *   would break if we suddenly stored an object. The reserved key
 *   tags object-shape values so the resolver only intercepts the ones
 *   it knows about. Anything else (e.g. the `{ url, alt }` shape from
 *   the image picker, or a future structured setting) passes through.
 *
 * Bindable-by-type matrix (enforced in the customizer's source picker):
 *
 *   text         | product.title, product.description (snippet),
 *                | collection.title, collection.description (snippet),
 *                | store.name, store.description
 *   textarea     | same as text + full descriptions
 *   richtext     | full descriptions only
 *   url          | not bindable yet — product/collection URLs require
 *                | the host's route resolver; deferred to a follow-up.
 *   image_picker | product.image, collection.image, store.logo
 *   number/range | product.price (raw cents) — risky because format
 *                | varies. Deferred.
 *   color/checkbox/select/radio/font | not bindable.
 *
 * Themes consume dynamic sources via `useResolvedSettings(instance)`
 * which returns the section's settings map with every dynamic ref
 * pre-resolved against the active product/collection/store context.
 * Literal values pass through unchanged.
 */

import type { Collection, Product, Store } from "../types/entities";

/** Stored shape for a dynamic source reference. */
export interface DynamicSourceRef {
  __numu_source: string;
}

/**
 * Type guard. True when `value` is a dynamic source reference object.
 * Order matters: we check the discriminant key BEFORE assuming the
 * value is anything else, so an `{ __numu_source: "..." }` from the
 * draft doesn't get treated as a literal record.
 */
export function isDynamicSource(value: unknown): value is DynamicSourceRef {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { __numu_source?: unknown }).__numu_source === "string"
  );
}

/**
 * Build a fresh dynamic source ref. Pure helper used by the customizer
 * when the merchant clicks a source in the picker.
 */
export function dynamicSource(path: string): DynamicSourceRef {
  return { __numu_source: path };
}

/** Resolution context for `resolveDynamicValue`. Each field is
 *  independently optional so callers can pass only what's relevant
 *  (e.g. cart template skips product/collection). */
export interface DynamicResolveContext {
  product?: Product | null;
  collection?: Collection | null;
  store?: Pick<Store, "name" | "description" | "logo_url"> | null;
}

/**
 * Look up the path inside the resolution context. Returns `null` when
 * the source is unknown OR the context doesn't have the resource
 * needed to resolve it (e.g. `product.title` when no product is in
 * context). The customizer's source picker already hides incompatible
 * sources, so this fallback only fires during preview navigation
 * (merchant flips to a product template before the picker re-renders).
 */
export function resolveSourcePath(
  path: string,
  ctx: DynamicResolveContext,
): unknown {
  const [root, ...rest] = path.split(".");
  switch (root) {
    case "product": {
      const p = ctx.product;
      if (!p) return null;
      return resolveProductField(p, rest.join("."));
    }
    case "collection": {
      const c = ctx.collection;
      if (!c) return null;
      return resolveCollectionField(c, rest.join("."));
    }
    case "store": {
      const s = ctx.store;
      if (!s) return null;
      return resolveStoreField(s, rest.join("."));
    }
    default:
      return null;
  }
}

function resolveProductField(p: Product, field: string): unknown {
  switch (field) {
    case "title":
    case "name":
      return p.name;
    case "description":
      return p.description ?? "";
    case "description_snippet":
      // 200-char excerpt — useful for short-description settings that
      // would otherwise inherit a full HTML body.
      return (p.description ?? "").replace(/<[^>]+>/g, " ").trim().slice(0, 200);
    case "price":
      return p.price;
    case "sku":
      // SKU lives on the default variant in most stores.
      return p.variants?.[0]?.sku ?? null;
    case "image":
    case "first_image_url":
      return p.images?.[0]?.url ?? null;
    case "slug":
      return p.slug;
    default:
      return null;
  }
}

function resolveCollectionField(c: Collection, field: string): unknown {
  switch (field) {
    case "title":
    case "name":
      return c.name;
    case "description":
      return c.description ?? "";
    case "description_snippet":
      return (c.description ?? "").replace(/<[^>]+>/g, " ").trim().slice(0, 200);
    case "image":
      return c.image_url ?? null;
    case "slug":
      return c.slug;
    case "product_count":
      return c.product_count ?? null;
    default:
      return null;
  }
}

function resolveStoreField(
  s: Pick<Store, "name" | "description" | "logo_url">,
  field: string,
): unknown {
  switch (field) {
    case "name":
      return s.name ?? "";
    case "description":
      return s.description ?? "";
    case "logo":
      return s.logo_url ?? null;
    default:
      return null;
  }
}

/**
 * Resolve a single setting value. Literal values pass through
 * unchanged; dynamic references resolve against the context. Returns
 * `null` (not the original ref) when resolution fails, so themes can
 * branch on the null and either render a placeholder or hide the
 * element entirely.
 */
export function resolveDynamicValue<T = unknown>(
  value: unknown,
  ctx: DynamicResolveContext,
): T | null {
  if (!isDynamicSource(value)) return value as T;
  return resolveSourcePath(value.__numu_source, ctx) as T | null;
}

/**
 * Walk every key of a settings map and resolve every dynamic
 * reference. Pure helper backing `useResolvedSettings`.
 *
 * The generic is unconstrained on purpose. Theme authors typically
 * type their settings as `interface HeroSettings { headline?: string }`,
 * and TypeScript interfaces don't implicitly satisfy
 * `Record<string, unknown>` — there's no index signature on an
 * interface. Leaving `T` open lets us pass through whatever shape the
 * caller declared and still return the resolved-but-same shape.
 */
export function resolveSettingsMap<T = Record<string, unknown>>(
  settings: T,
  ctx: DynamicResolveContext,
): T {
  if (!settings || typeof settings !== "object") return settings;
  const input = settings as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    const v = input[key];
    if (isDynamicSource(v)) {
      const resolved = resolveSourcePath(v.__numu_source, ctx);
      // Preserve nullish from resolution failure so the consumer can
      // detect "I asked for product.title but no product is active."
      out[key] = resolved;
    } else {
      out[key] = v;
    }
  }
  return out as T;
}
