import { useContext } from "react";
import { PageContext } from "../contexts";
import type { Page } from "../types/entities";

export function usePage(): Page | null {
  return useContext(PageContext);
}
