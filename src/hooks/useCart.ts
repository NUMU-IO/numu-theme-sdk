import { useContext } from "react";
import { CartContext } from "../contexts";

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within NuMuProvider");
  return ctx;
}
