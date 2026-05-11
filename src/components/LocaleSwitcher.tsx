"use client";

import { useCallback } from "react";
import { useShop } from "../hooks/useShop";
import { useLocalization } from "../hooks/useLocalization";

/**
 * <LocaleSwitcher /> — language toggle for stores with multiple locales.
 *
 * v1 supports Arabic + English (the storefront's default_language gates
 * which one is the "primary"). This component:
 *   - Reads `store.available_locales` (or falls back to
 *     [default_language, "en"] for stores that haven't been migrated yet).
 *   - Renders nothing when there's only one locale.
 *   - On change, sets a `numu_locale` cookie + reloads the page so the
 *     server-rendered layout picks up the new locale (the storefront
 *     middleware reads the cookie and stamps `<html lang/dir>`
 *     accordingly).
 *
 * Why a hard reload instead of client-side state swap:
 *   Locale impacts SSR-rendered content (currency formatting, product
 *   field translations, page metadata). Client-side toggling would
 *   leave the SSR output inconsistent until the next navigation.
 *   One reload trades a brief flicker for guaranteed correctness.
 */

const LANG_LABELS: Record<string, string> = {
  ar: "العربية",
  en: "English",
  fr: "Français",
  he: "עברית",
  fa: "فارسی",
  ur: "اردو",
  es: "Español",
  de: "Deutsch",
};

export interface LocaleSwitcherProps {
  className?: string;
  onSelect?: (locale: string) => void;
  /** Custom renderer. Receives the resolved locale list + current selection. */
  render?: (state: {
    locales: string[];
    current: string;
    labelFor: (code: string) => string;
    onChange: (next: string) => void;
  }) => React.ReactNode;
}

export function LocaleSwitcher({
  className,
  onSelect,
  render,
}: LocaleSwitcherProps) {
  const shop = useShop();
  const { locale } = useLocalization();
  const available =
    (shop as unknown as { available_locales?: string[] }).available_locales || [];
  // Fallback for stores that don't yet expose available_locales: assume
  // the store's default_language plus English when they differ.
  const list =
    available.length > 0
      ? available
      : shop.default_language === "en"
        ? ["en"]
        : Array.from(new Set([shop.default_language, "en"]));

  const labelFor = useCallback((code: string): string => {
    return LANG_LABELS[code] || code.toUpperCase();
  }, []);

  const handleChange = useCallback(
    (next: string) => {
      if (next === locale) return;
      onSelect?.(next);
      if (typeof document !== "undefined") {
        const oneYear = 60 * 60 * 24 * 365;
        document.cookie = `numu_locale=${encodeURIComponent(next)}; path=/; max-age=${oneYear}; samesite=lax`;
      }
      // Hard reload so SSR re-runs with the new locale. Use replace()
      // so the locale toggle doesn't pollute browser back history.
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    },
    [locale, onSelect],
  );

  if (list.length <= 1) return null;

  if (render) {
    return <>{render({ locales: list, current: locale, labelFor, onChange: handleChange })}</>;
  }

  return (
    <select
      className={className ?? "numu-locale-switcher"}
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Language"
    >
      {list.map((l) => (
        <option key={l} value={l}>
          {labelFor(l)}
        </option>
      ))}
    </select>
  );
}
