"use client";
import { useCallback } from "react";
import { useCachedResource } from "../lib/dataCache";
import type { ActivePromotionsPayload } from "../types/promotions";

/**
 * The store's active promotions for the current visitor.
 *
 * Reads the host proxy `GET /api/storefront/promotions` (never NUMU-api
 * directly — the host owns credentials, caching and the store resolution).
 * The backend groups by surface; the host already renders announcement bars,
 * popups, the cookie banner and floating widgets in the shell, so what a
 * theme normally wants is `auto_discounts` — the offers that price the cart
 * with no code to type.
 *
 * SSR-safe: `useCachedResource` doesn't fetch during server render, so this
 * resolves on hydrate. Sections must therefore tolerate a null first pass —
 * render nothing (or a skeleton) rather than assuming data on first paint.
 *
 * Returns `null` on any miss (offline, 404, flag off). That is deliberate:
 * a promotions outage should make an offer banner disappear, never break the
 * page it sits on.
 *
 * @param page   page path used for page-targeted promotions (default "/")
 * @param locale "ar" | "en" — selects the translated content
 */
export function useActivePromotions(
  page: string = "/",
  locale: string = "ar",
): ActivePromotionsPayload | null {
  const key = `numu:promotions:${page}:${locale}`;

  const fetcher = useCallback(
    async (signal: AbortSignal): Promise<ActivePromotionsPayload | null> => {
      const qs = new URLSearchParams({ page, locale });
      const res = await fetch(`/api/storefront/promotions?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
        signal,
      });
      if (!res.ok) return null;
      const json = (await res.json()) as
        | { data?: ActivePromotionsPayload }
        | ActivePromotionsPayload
        | null;
      if (!json) return null;
      return (
        ((json as { data?: ActivePromotionsPayload }).data ??
          (json as ActivePromotionsPayload)) ||
        null
      );
    },
    [page, locale],
  );

  const { data } = useCachedResource<ActivePromotionsPayload | null>(
    key,
    fetcher,
    { initialData: null },
  );

  return data ?? null;
}
