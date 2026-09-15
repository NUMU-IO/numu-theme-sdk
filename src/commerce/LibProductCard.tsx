"use client";

/**
 * LibProductCard — the product card library sections share: image, title,
 * price with a struck compare-at, discount and sold-out badges, and an
 * optional quick-add. Works with list, related and detail payloads.
 *
 * Styled with theme tokens and logical properties like every `lib-*` section,
 * so it inherits each theme's fonts and colours. The quick-add button sits
 * next to the link, not inside it (no interactive element inside an `<a>`).
 * `--lib-card-ratio` on an ancestor sets the image shape (default 3/4).
 */

import { Link } from "../components/Link";
import { Money } from "../components/Money";
import { useLocale } from "../hooks/useLocalization";
import { LibStyle, imageAlt, imageUrl, localized, responsiveImg } from "../sections/_shared";
import type { Product } from "../types/entities";
import { productHref } from "../utils/routes";
import { cardPrice, discountPercent, inStock, useQuickAdd, type QuickAddOptions } from "./core";

const CARD_WIDTHS = [256, 384, 640, 768] as const;

const CSS = `
.lib-card{position:relative;display:flex;flex-direction:column;gap:.625rem;min-inline-size:0}
.lib-card-link{display:flex;flex-direction:column;gap:.5rem;color:inherit;text-decoration:none}
.lib-card-link:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.lib-card-media{position:relative;display:block;overflow:hidden;aspect-ratio:var(--lib-card-ratio,3/4);background:color-mix(in srgb,currentColor 8%,transparent)}
.lib-card-media img{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover;transition:transform .6s ease}
.lib-card-link:hover .lib-card-media img{transform:scale(1.04)}
.lib-card.is-soldout .lib-card-media img{opacity:.55}
.lib-card-badge{position:absolute;inset-block-start:.5rem;inset-inline-start:.5rem;padding:.2rem .5rem;font-size:.7rem;font-weight:600;line-height:1.2;color:var(--theme-color-background,#fff);background:var(--theme-color-accent,#111)}
.lib-card-badge.is-soldout{color:var(--theme-color-text,#111);background:var(--theme-color-background,#fff)}
.lib-card-title{font-weight:500;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.lib-card-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:.5rem;font-size:.9rem}
.lib-card-was{opacity:.6}
.lib-card-add{inline-size:100%;padding-block:.625rem;padding-inline:.75rem;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;font-size:.8rem;font-weight:500;cursor:pointer;transition:background-color .2s ease}
.lib-card-add:hover{background:color-mix(in srgb,currentColor 10%,transparent)}
.lib-card-add:disabled{opacity:.6;cursor:progress}
.lib-card-add:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.lib-card-add.is-error{border-color:#b42318;color:#b42318}
.lib-card-error{font-size:.75rem;color:#b42318}
.lib-card-sr{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.lib-card-media img,.lib-card-add{transition:none}}
`;

export interface LibProductCardProps {
  product: Product;
  /** Default true. */
  showQuickAdd?: boolean;
  /** Default true. */
  showDiscountBadge?: boolean;
  /** `sizes` for the image srcSet. Default: a 4-up desktop, 2-up phone grid. */
  imageSizes?: string;
  onNeedsOptions?: QuickAddOptions["onNeedsOptions"];
}

export function LibProductCard({
  product,
  showQuickAdd = true,
  showDiscountBadge = true,
  imageSizes = "(min-width: 768px) 25vw, 50vw",
  onNeedsOptions,
}: LibProductCardProps) {
  const locale = useLocale();
  const { price, compareAt } = cardPrice(product);
  const percent = discountPercent(price, compareAt);
  const soldOut = !inStock(product);
  const image = product.images?.[0];
  const src = imageUrl(image);

  return (
    <article className={soldOut ? "lib-card is-soldout" : "lib-card"}>
      <LibStyle id="lib-product-card" css={CSS} />
      <Link to={productHref(product.slug || product.id)} className="lib-card-link">
        <span className="lib-card-media">
          {src && (
            // The title sits right under the image, so an undescribed image is decorative.
            <img {...responsiveImg(src, { widths: CARD_WIDTHS, sizes: imageSizes })} alt={imageAlt(image, "")} loading="lazy" decoding="async" />
          )}
          {soldOut ? (
            <span className="lib-card-badge is-soldout">{localized(locale, "Sold out", "خلصت الكمية")}</span>
          ) : (
            showDiscountBadge &&
            percent > 0 && (
              <span className="lib-card-badge" dir="ltr">
                {`-${percent}%`}
              </span>
            )
          )}
        </span>
        <span className="lib-card-title">{product.name}</span>
        <span className="lib-card-price">
          <Money amount={price} className="lib-card-now" />
          {percent > 0 && (
            <s className="lib-card-was">
              <Money amount={compareAt!} />
            </s>
          )}
        </span>
      </Link>
      {showQuickAdd && !soldOut && <QuickAddButton product={product} locale={locale} onNeedsOptions={onNeedsOptions} />}
    </article>
  );
}

function QuickAddButton({
  product,
  locale,
  onNeedsOptions,
}: {
  product: Product;
  locale: string;
  onNeedsOptions?: QuickAddOptions["onNeedsOptions"];
}) {
  const { state, add, failMessage } = useQuickAdd(product, { onNeedsOptions });
  const label =
    state === "loading"
      ? localized(locale, "Adding…", "بنضيفه…")
      : state === "added"
        ? localized(locale, "Added", "اتضاف للسلة")
        : state === "error"
          ? localized(locale, "Couldn't add", "مقدرناش نضيفه")
          : localized(locale, "Add to bag", "أضف للسلة");
  const announce = state === "error" ? failMessage || label : state === "added" ? label : "";

  return (
    <>
      <button
        type="button"
        className={state === "error" ? "lib-card-add is-error" : "lib-card-add"}
        onClick={add}
        disabled={state === "loading"}
        aria-busy={state === "loading"}
      >
        {label}
      </button>
      {/* The backend's refusal is shown, not only announced: tooltips don't exist on phones. */}
      <span className={state === "error" && failMessage ? "lib-card-error" : "lib-card-sr"} role="status" aria-live="polite">
        {announce}
      </span>
    </>
  );
}
