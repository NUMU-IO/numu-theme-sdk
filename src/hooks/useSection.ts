import { createContext, useContext } from "react";
import type { SectionInstance } from "../types/theme";

export const SectionContext = createContext<SectionInstance | null>(null);

export function useSection(): SectionInstance {
  const ctx = useContext(SectionContext);
  if (!ctx) throw new Error("useSection must be used within a section component");
  return ctx;
}

export function useSectionOptional(): SectionInstance | null {
  return useContext(SectionContext);
}
