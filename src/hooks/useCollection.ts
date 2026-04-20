import { useContext } from "react";
import { CollectionContext } from "../contexts";
import type { Collection } from "../types/entities";

export function useCollection(): Collection {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error("useCollection must be used within CollectionProvider");
  return ctx;
}

export function useCollectionOptional(): Collection | null {
  return useContext(CollectionContext);
}
