"use client";

import type { ReactNode } from "react";
import type { Collection } from "../types/entities";
import { Image } from "./Image";
import { Link } from "./Link";

/**
 * Opinionated collection tile.
 *
 * Renders a single collection's hero image + name + product count.
 * Used by collection-list sections, footer "Featured collections"
 * blocks, and search-result mixed views.
 *
 * Unstyled by default; themes ship the CSS. Class hooks:
 *   .numu-collection-card           — root <article>
 *   .numu-collection-card__link     — wrapping <a>
 *   .numu-collection-card__media    — image container
 *   .numu-collection-card__image    — the <img>
 *   .numu-collection-card__title    — title <h3>
 *   .numu-collection-card__count    — product count line
 */
export interface CollectionCardSlots {
  title?: ReactNode;
  /** Replaces the "N products" line. Pass null to hide it. */
  count?: ReactNode | null;
}

export interface CollectionCardProps {
  collection: Collection;
  /** Override the link target. Default: `/collections/{slug}`. */
  href?: string;
  className?: string;
  slots?: CollectionCardSlots;
  imageSizes?: string;
}

function joinClass(...names: Array<string | undefined | null | false>): string {
  return names.filter(Boolean).join(" ");
}

export function CollectionCard({
  collection,
  href,
  className,
  slots,
  imageSizes,
}: CollectionCardProps) {
  const target = href ?? `/collections/${collection.slug}`;
  const productCount =
    typeof collection.product_count === "number"
      ? collection.product_count
      : undefined;

  return (
    <article className={joinClass("numu-collection-card", className)}>
      <Link to={target} className="numu-collection-card__link">
        <div className="numu-collection-card__media">
          <Image
            src={collection.image_url}
            alt={collection.name}
            sizes={imageSizes}
            className="numu-collection-card__image"
          />
        </div>
        {slots?.title ?? (
          <h3 className="numu-collection-card__title">{collection.name}</h3>
        )}
        {slots?.count === null
          ? null
          : (slots?.count ?? (
              productCount !== undefined && (
                <p className="numu-collection-card__count">
                  {productCount === 1 ? "1 product" : `${productCount} products`}
                </p>
              )
            ))}
      </Link>
    </article>
  );
}
