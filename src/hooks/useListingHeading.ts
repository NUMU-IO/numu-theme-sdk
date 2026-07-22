import { useContext } from "react";
import { CollectionContext } from "../contexts";
import type { Collection } from "../types/entities";

export interface ListingHeading {
  /** The collection the shopper is inside, or `null` on the all-products listing. */
  collection: Collection | null;
  /** `true` when this listing is scoped to one collection. */
  isCollection: boolean;
  /** What to render as the page heading. */
  title: string;
  /** What to render under it. Empty string when there is nothing to say. */
  description: string;
}

export interface ListingHeadingOptions {
  /** The merchant's own heading from this section's settings, if they set one. */
  title?: string | null;
  /** The merchant's own sub-heading from this section's settings. */
  description?: string | null;
  /**
   * The theme's wording for the UNSCOPED listing — already localized by the
   * theme, e.g. `localized(locale, "All products", "كل المنتجات")`.
   */
  defaultTitle?: string | null;
}

/**
 * What a product-listing section should call itself.
 *
 * Every theme hardcoded "All products" as its listing heading, so a shopper who
 * clicked into a category landed on a page titled **All products** showing a
 * subset of the catalog. The products were correctly scoped — the page just
 * never said which collection it was. That reads as a bug ("where did the rest
 * go?") and it costs the collection name in the one place it matters most.
 *
 * Precedence, highest first:
 *   1. the collection's own name — when the shopper is inside one, that IS the
 *      page, and it always beats a static setting;
 *   2. the merchant's section setting — their wording for the all-products page;
 *   3. the theme's default.
 *
 * Categories carry no separate Arabic column, so `collection.name` is rendered
 * as the merchant typed it; only the fallback is localized, by the caller.
 *
 * @example
 * const { title, description, isCollection } = useListingHeading({
 *   title: asString(s.title),
 *   description: asString(s.subtitle),
 *   defaultTitle: localized(locale, "All products", "كل المنتجات"),
 * });
 */
export function useListingHeading(
  options: ListingHeadingOptions = {},
): ListingHeading {
  const collection = useContext(CollectionContext);
  const clean = (v: unknown): string =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : "";

  const collectionName = clean(collection?.name);
  const collectionDescription = clean(
    (collection as { description?: unknown } | null)?.description,
  );

  return {
    collection: collection ?? null,
    isCollection: collectionName !== "",
    title:
      collectionName ||
      clean(options.title) ||
      clean(options.defaultTitle) ||
      "",
    description:
      collectionDescription || clean(options.description) || "",
  };
}
