import { useContext } from "react";
import { ProductContext } from "../contexts";
import type { Product } from "../types/entities";

export function useProduct(): Product {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error("useProduct must be used within ProductProvider");
  return ctx;
}

export function useProductOptional(): Product | null {
  return useContext(ProductContext);
}
