"use client";
import type { ReactNode } from "react";
import { ProductContext } from "../contexts";
import type { Product } from "../types/entities";

interface ProductProviderProps {
  product: Product;
  children: ReactNode;
}

export function ProductProvider({ product, children }: ProductProviderProps) {
  return <ProductContext.Provider value={product}>{children}</ProductContext.Provider>;
}
