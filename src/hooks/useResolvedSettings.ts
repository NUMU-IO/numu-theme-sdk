"use client";
import { useContext, useMemo } from "react";
import { ProductContext, CollectionContext, ShopContext } from "../contexts";
import type { BlockInstance, SectionInstance } from "../types/theme";
import {
  type DynamicResolveContext,
  resolveSettingsMap,
} from "../utils/dynamicSources";

/**
 * Resolve every dynamic source in a section's settings against the
 * active product / collection / store contexts.
 *
 * Section components that want to support merchant-bound fields call
 * this in place of reading `instance.settings` directly:
 *
 *   const settings = useResolvedSettings(instance);
 *
 * Literal values pass through; `{ __numu_source: "product.title" }`
 * becomes the current product's title when the section is rendered
 * inside a `<ProductProvider>`. The returned object is memoized on
 * the upstream contexts so themes can pass it straight into
 * `useMemo` deps without retriggering renders.
 *
 * When the bound resource isn't in context (e.g. `product.*` on a
 * non-product template), the resolved value is `null`. Themes can
 * detect this and render a placeholder or hide the affected element.
 *
 * Note: the SectionContext provider already supplies the `instance`
 * to children of `<Section>` — but we take it explicitly so section
 * components can call this hook before they've descended into
 * SectionContext (i.e. at the top of their render function, alongside
 * destructuring `settings` from props).
 */
export function useResolvedSettings<T = Record<string, unknown>>(
  instance: SectionInstance | BlockInstance | null | undefined,
): T {
  const product = useContext(ProductContext);
  const collection = useContext(CollectionContext);
  const store = useContext(ShopContext);

  // Stabilize the resolution context object so the memo only invalidates
  // when one of the upstream values actually changes. Without this each
  // render would build a fresh `{ product, collection, store }` and the
  // useMemo dep array would never hit.
  const ctx = useMemo<DynamicResolveContext>(
    () => ({ product, collection, store }),
    [product, collection, store],
  );

  return useMemo(() => {
    const settings = (instance?.settings ?? {}) as T;
    return resolveSettingsMap<T>(settings, ctx);
  }, [instance, ctx]);
}
