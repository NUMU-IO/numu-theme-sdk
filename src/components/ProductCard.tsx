"use client";

import type { ReactNode } from "react";
import type { Product } from "../types/entities";
import { Image } from "./Image";
import { Money } from "./Money";
import { Link } from "./Link";
import { AddToCartButton } from "./AddToCartButton";

/**
 * Opinionated product tile.
 *
 * Themes drop this anywhere a product list is needed — collection
 * pages, search results, recommendations, recently-viewed grids.
 * Renders image + title + price (with compare-at strike-through when
 * present) + an optional "Sold out" badge + AddToCartButton.
 *
 * The component is **unstyled by default** — it ships only structural
 * markup with stable class names. Themes provide the CSS. Class names
 * use a `numu-product-card__*` BEM convention so themes can target
 * pieces without grep-and-replace if NUMU later renames anything.
 *
 * Class hooks:
 *   .numu-product-card           — root <article>
 *   .numu-product-card__link     — wrapping <a>
 *   .numu-product-card__media    — image container
 *   .numu-product-card__image    — the <img> itself
 *   .numu-product-card__badge    — "Sold out" overlay
 *   .numu-product-card__title    — title <h3>
 *   .numu-product-card__price    — price wrapper
 *   .numu-product-card__cta      — CTA wrapper (AddToCartButton)
 *
 * Themes can override any piece by passing `slots`:
 *   <ProductCard product={p} slots={{ price: <CustomPrice /> }} />
 *
 * For deeper customization, themes should compose the primitives
 * (Image / Money / Link / AddToCartButton) directly instead.
 */
export interface ProductCardSlots {
  /** Replaces the badge area (default: "Sold out" when out of stock, else nothing). */
  badge?: ReactNode;
  /** Replaces the title `<h3>` block. */
  title?: ReactNode;
  /** Replaces the price `<Money>` block. */
  price?: ReactNode;
  /** Replaces the AddToCartButton. Pass `null` to hide it. */
  cta?: ReactNode | null;
}

export interface ProductCardProps {
  product: Product;
  /** Override the link target. Default: `/products/{slug}`. */
  href?: string;
  className?: string;
  slots?: ProductCardSlots;
  /**
   * Image sizing hint for the responsive srcSet. Default: a 4-up grid
   * sizing (~25vw at desktop, ~50vw at tablet, ~100vw at mobile).
   * Override when rendering in a different layout density.
   */
  imageSizes?: string;
}

function joinClass(...names: Array<string | undefined | null | false>): string {
  return names.filter(Boolean).join(" ");
}

export function ProductCard({
  product,
  href,
  className,
  slots,
  imageSizes,
}: ProductCardProps) {
  const target = href ?? `/products/${product.slug}`;
  const firstImage = product.images?.[0];
  const inStock = product.in_stock;

  const badge =
    slots?.badge !== undefined
      ? slots.badge
      : inStock
        ? null
        : (
            <span className="numu-product-card__badge">Sold out</span>
          );

  return (
    <article className={joinClass("numu-product-card", className)}>
      <Link to={target} className="numu-product-card__link">
        <div className="numu-product-card__media">
          <Image
            src={firstImage?.url}
            alt={firstImage?.alt || product.name}
            sizes={imageSizes}
            className="numu-product-card__image"
          />
          {badge}
        </div>
        {slots?.title ?? (
          <h3 className="numu-product-card__title">{product.name}</h3>
        )}
        {slots?.price ?? (
          <div className="numu-product-card__price">
            <Money
              amount={product.price}
              compareAt={product.compare_at_price}
              currency={product.currency}
            />
          </div>
        )}
      </Link>
      {slots?.cta === null
        ? null
        : (
            <div className="numu-product-card__cta">
              {slots?.cta ?? <AddToCartButton product={product} />}
            </div>
          )}
    </article>
  );
}
