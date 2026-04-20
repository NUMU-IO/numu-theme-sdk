import { useContext } from "react";
import { LocalizationContext } from "../contexts";
import type { LocalizationState } from "../contexts";

export function useLocalization(): LocalizationState {
  const ctx = useContext(LocalizationContext);
  if (!ctx) throw new Error("useLocalization must be used within NuMuProvider");
  return ctx;
}

export function useDirection(): "ltr" | "rtl" {
  const { direction } = useLocalization();
  return direction;
}

export function useTranslation() {
  const { translations, locale } = useLocalization();
  return {
    t: (key: string, fallback?: string) => translations[key] || fallback || key,
    locale,
  };
}
