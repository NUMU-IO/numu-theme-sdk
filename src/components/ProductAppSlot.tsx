"use client";

/**
 * A place on the product page where installed apps render, with no theme
 * rebuild when an app is added.
 *
 * Themes put one slot at each position of their main product form:
 *
 *     <ProductAppSlot position="below_title" product={product} variant={variant} />
 *     <ProductAppSlot position="before_buy" product={product} variant={variant} />
 *     <ProductAppSlot position="after_buy" product={product} variant={variant} />
 *
 * `below_title` sits under the title and price, `before_buy` above the
 * quantity and buy row, `after_buy` under it. Pass the theme's own selected
 * variant. An app renders only when the store payload lists it as installed
 * (`useHasApp`), so a store without apps gets no markup at all — not even a
 * wrapper element.
 */

import type { ComponentType } from "react";
import { useHasApp } from "../hooks/useInstalledApp";
import type { Product, ProductVariant } from "../types/entities";
import { NotifyMe } from "./apps/NotifyMe";

export type ProductAppSlotPosition = "below_title" | "before_buy" | "after_buy";

export interface ProductAppSlotProps {
  position: ProductAppSlotPosition;
  product: Product;
  /** The theme's selected variant; empty before the shopper picks one. */
  variant?: ProductVariant | null;
}

type AppProps = Omit<ProductAppSlotProps, "position">;

/** The apps at each position, in render order. */
const SLOT_APPS: Record<ProductAppSlotPosition, ReadonlyArray<readonly [string, ComponentType<AppProps>]>> = {
  below_title: [],
  before_buy: [],
  after_buy: [["back-in-stock", NotifyMe]],
};

function SlotApp({ slug, Render, ...props }: AppProps & { slug: string; Render: ComponentType<AppProps> }) {
  return useHasApp(slug) ? <Render {...props} /> : null;
}

export function ProductAppSlot({ position, ...props }: ProductAppSlotProps) {
  return (
    <>
      {(SLOT_APPS[position] ?? []).map(([slug, Render]) => (
        <SlotApp key={slug} slug={slug} Render={Render} {...props} />
      ))}
    </>
  );
}
