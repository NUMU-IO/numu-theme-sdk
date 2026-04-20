import { useContext } from "react";
import { ThemeSettingsContext } from "../contexts";
import type { ThemeSettingsV3 } from "../types/theme";

export function useThemeSettings(): ThemeSettingsV3 {
  const ctx = useContext(ThemeSettingsContext);
  if (!ctx) throw new Error("useThemeSettings must be used within NuMuProvider");
  return ctx;
}
