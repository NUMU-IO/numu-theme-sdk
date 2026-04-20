"use client";
import type { ReactNode } from "react";
import { CollectionContext } from "../contexts";
import type { Collection } from "../types/entities";

interface CollectionProviderProps {
  collection: Collection;
  children: ReactNode;
}

export function CollectionProvider({ collection, children }: CollectionProviderProps) {
  return <CollectionContext.Provider value={collection}>{children}</CollectionContext.Provider>;
}
