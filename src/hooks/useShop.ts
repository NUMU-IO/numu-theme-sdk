import { useContext } from "react";
import { ShopContext } from "../contexts";
import type { Store } from "../types/entities";

export function useShop(): Store {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within NuMuProvider");
  return ctx;
}
