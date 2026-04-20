import { useContext } from "react";
import { CustomerContext } from "../contexts";
import type { Customer } from "../types/entities";

export function useCustomer(): Customer | null {
  return useContext(CustomerContext);
}
