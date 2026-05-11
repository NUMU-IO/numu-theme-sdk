"use client";

import { createContext } from "react";

/**
 * The action surface a theme can call to drive customer auth +
 * profile mutations. Each action returns the parsed response body
 * (or throws on network failure); the *result* of the operation is
 * conveyed by the response shape, not the throw boundary.
 *
 * The provider implements these by calling /api/customer/* proxy
 * routes on the storefront, which in turn forward to FastAPI's
 * /storefront/store/{store_id}/auth/* and /storefront/me/* endpoints.
 *
 * Why a separate context (vs bundling onto CustomerContext): the
 * value `Customer | null` was already in CustomerContext for
 * back-compat with themes that read `useCustomer()`. Adding a
 * sibling context for actions keeps the existing read hook stable
 * while letting themes opt into actions via `useCustomerActions()`.
 */
export interface CustomerActions {
  /** Email + password → returns { success, data?, error? }. On
   * success the SDK refreshes the customer context automatically. */
  login: (input: {
    email: string;
    password: string;
  }) => Promise<unknown>;

  /** Create a new customer + log them in. Some stores require
   * email verification before login is fully usable; this flow
   * still issues the auth cookie so the customer can verify from
   * the welcome email and land logged-in. */
  register: (input: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    accepts_marketing?: boolean;
  }) => Promise<unknown>;

  /** Clear the customer_access_token cookie + refresh the context
   * to null. Idempotent: safe to call when not logged in. */
  logout: () => Promise<unknown>;

  /** Issue a password-reset email. Anti-enumeration: response
   * never reveals whether the email exists. */
  requestRecover: (input: { email: string }) => Promise<unknown>;

  /** Submit the new password with the token from the recovery email. */
  confirmReset: (input: {
    token: string;
    password: string;
  }) => Promise<unknown>;

  /** Verify the email with the token from the welcome email. */
  verifyEmail: (input: { token: string }) => Promise<unknown>;

  /** Resend the verification email. Server-side rate-limited to
   * prevent email-bombing. */
  resendVerification: (input: { email: string }) => Promise<unknown>;

  /** Update the customer's profile (name / phone / marketing). */
  updateProfile: (input: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    accepts_marketing?: boolean;
  }) => Promise<unknown>;

  /** Change the customer's password from inside the dashboard.
   * Backend requires the current password as confirmation. */
  changePassword: (input: {
    current_password: string;
    new_password: string;
  }) => Promise<unknown>;

  /** Re-fetch the customer profile from the backend and replace
   * the context value. Themes call this after performing any
   * out-of-band mutation that changed the customer's record. */
  refresh: () => Promise<void>;
}

const NOOP_ACTIONS: CustomerActions = {
  login: async () => ({}),
  register: async () => ({}),
  logout: async () => ({}),
  requestRecover: async () => ({}),
  confirmReset: async () => ({}),
  verifyEmail: async () => ({}),
  resendVerification: async () => ({}),
  updateProfile: async () => ({}),
  changePassword: async () => ({}),
  refresh: async () => undefined,
};

export const CustomerActionsContext =
  createContext<CustomerActions>(NOOP_ACTIONS);
