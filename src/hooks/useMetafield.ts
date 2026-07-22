import { useContext } from "react";
import { CollectionContext, PageContext, ProductContext } from "../contexts";
import type { Metafield } from "../types/entities";

/**
 * Owners a theme can read metafields from. Matches the platform's
 * metafield owner types (product / collection / page). Only PUBLIC
 * metafields ever reach the storefront — the privacy filter runs
 * server-side at the payload layer, so a private field is simply absent
 * here, never present-but-hidden.
 */
export type MetafieldOwner = "product" | "collection" | "page";

function isMetafield(value: unknown): value is Metafield {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Metafield).namespace === "string" &&
    typeof (value as Metafield).key === "string"
  );
}

/**
 * CMS page routes project the page record at `page.data.page` (see the
 * host's `/pages/[handle]` route); other page types may surface a flat
 * `data.metafields`. Accept both, prefer the nested record.
 */
function pageMetafields(data: Record<string, unknown> | undefined): Metafield[] {
  if (!data) return [];
  const record = data.page as Record<string, unknown> | undefined;
  for (const candidate of [record?.metafields, data.metafields]) {
    if (Array.isArray(candidate)) return candidate.filter(isMetafield);
  }
  return [];
}

/**
 * All public metafields of the given owner currently in context.
 * Empty array when the owner isn't in context (e.g. `"product"` on a
 * collection page) or has no fields — never throws.
 */
export function useMetafields(owner: MetafieldOwner): Metafield[] {
  const product = useContext(ProductContext);
  const collection = useContext(CollectionContext);
  const page = useContext(PageContext);
  switch (owner) {
    case "product":
      return product?.metafields ?? [];
    case "collection":
      return collection?.metafields ?? [];
    case "page":
      return pageMetafields(page?.data);
    default:
      return [];
  }
}

/**
 * Read one merchant-defined field directly:
 *
 * ```tsx
 * const material = useMetafield("product", "specs", "material");
 * if (material) <dd>{String(material.value)}</dd>;
 * ```
 *
 * Returns the full {@link Metafield} (value pre-coerced to its declared
 * type by the platform) or `null` when missing — same convention as the
 * dynamic-source resolver (`{owner}.metafield:{namespace}.{key}`), so a
 * theme's own fallback renders for stores that haven't set the field.
 */
export function useMetafield(
  owner: MetafieldOwner,
  namespace: string,
  key: string,
): Metafield | null {
  const fields = useMetafields(owner);
  return (
    fields.find((m) => m.namespace === namespace && m.key === key) ?? null
  );
}
