"use client";
import { useMemo } from "react";
import type { Product, Store, SizeChart } from "../types/entities";
import { useProductOptional } from "./useProduct";
import { useShop } from "./useShop";

/**
 * useProductSizeChart — resolve the size chart to show for a product.
 *
 * The merchant hub writes the per-product chart to
 * `product.attributes.size_chart` and the store-wide default to
 * `store.settings.size_chart`, with an explicit `mode`:
 *
 *   "off"     → never show, even if a store default exists
 *   "custom"  → use the product's own chart
 *   "default" → fall back to the store-wide chart
 *   (legacy)  → no `mode`: a populated product chart wins, else the default
 *
 * This hook centralises that precedence so every theme resolves it identically
 * (the backend `SizeChartSchema` validator and the hub editor share the same
 * shape). Returns `null` when there is nothing to show — render the size-guide
 * trigger only when this is non-null.
 *
 * @param productOverride - resolve against this product instead of the one in
 *   context (e.g. when rendering a chart for a related/quick-view product).
 */
export function useProductSizeChart(
  productOverride?: Product | null,
): SizeChart | null {
  const ctxProduct = useProductOptional();
  const product = productOverride ?? ctxProduct;
  const shop = useShop() as Store | undefined;
  const storeSettings = shop?.settings;

  return useMemo(
    () => resolveSizeChart(product?.attributes, storeSettings),
    [product?.attributes, storeSettings],
  );
}

function hasRows(c: unknown): c is SizeChart {
  return (
    !!c &&
    typeof c === "object" &&
    Array.isArray((c as SizeChart).rows) &&
    (c as SizeChart).rows.length > 0
  );
}

/**
 * Pure resolver (no React) — exported so non-hook code (SSR helpers, tests)
 * can apply the same precedence.
 */
export function resolveSizeChart(
  productAttributes: Record<string, unknown> | undefined,
  storeSettings: Record<string, unknown> | undefined,
): SizeChart | null {
  const product = productAttributes?.size_chart as SizeChart | undefined;
  const storeDefault = storeSettings?.size_chart as SizeChart | undefined;

  if (product?.mode === "off") return null;
  if (product?.mode === "custom") return hasRows(product) ? product : null;
  if (product?.mode === "default") return hasRows(storeDefault) ? storeDefault : null;

  // No explicit mode (legacy): a populated product chart wins, else the default.
  if (hasRows(product)) return product;
  if (hasRows(storeDefault)) return storeDefault;
  return null;
}
