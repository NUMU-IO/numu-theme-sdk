"use client";

import { useContext } from "react";
import { CustomerActionsContext, type CustomerActions } from "../contexts/customer-actions";

/**
 * Returns the customer-mutation actions provided by NuMuProvider.
 *
 * Pair with `useCustomer()` for read access:
 *
 *   const customer = useCustomer();
 *   const { login, logout, register } = useCustomerActions();
 *
 * The actions hit the storefront's `/api/customer/*` proxies, which
 * own the cookie/CSRF/idempotency story. Themes don't talk to the
 * backend directly — they get a stable client-side surface here.
 */
export function useCustomerActions(): CustomerActions {
  return useContext(CustomerActionsContext);
}
