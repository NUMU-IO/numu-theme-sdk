"use client";

import {
  useState,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactNode,
} from "react";

interface FormProps
  extends Omit<
    FormHTMLAttributes<HTMLFormElement>,
    "onSubmit" | "method" | "action" | "children" | "onError"
  > {
  /**
   * Endpoint to POST/etc. the form values to. Should be one of the
   * storefront's `/api/*` proxy routes — they handle CSRF + cookie
   * forwarding + idempotency on the way to FastAPI.
   */
  action: string;
  /**
   * HTTP method. POST is the typical theme use-case (newsletter,
   * contact, customer login, address create). GET is supported for
   * search-style forms.
   */
  method?: "POST" | "GET" | "PUT" | "DELETE";
  /**
   * Called with the JSON-decoded response body on success. Use to
   * trigger a toast, redirect, etc. Theme owns the UX.
   */
  onSuccess?: (response: unknown) => void;
  /**
   * Called with the Error on failure. Falls through to the default
   * error label otherwise.
   */
  onError?: (error: Error) => void;
  /**
   * Render-prop access to the in-flight state if the theme wants to
   * show its own loading / disabled / error UI. Default `children`
   * behavior just lets the form's inputs and submit button render —
   * we don't impose styling.
   */
  children?:
    | ReactNode
    | ((state: { submitting: boolean; error: Error | null }) => ReactNode);
}

const ABSOLUTE_URL = /^[a-z]+:|^\/\//i;

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)numu_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * <Form action="/api/cart/add" method="POST" onSuccess={...}>
 *
 * Theme-friendly wrapper around `<form>` that handles:
 *   - CSRF: reads `numu_csrf` cookie, sends as `x-numu-csrf` header on
 *     every mutating request. Same wire format as <NuMuProvider>'s
 *     cart machinery — interoperates seamlessly.
 *   - Idempotency: mints a UUID per submit, sends as
 *     `x-numu-idempotency-key`. Backend dedupes if it supports the
 *     header (cart endpoints today; more later).
 *   - Submit lifecycle: tracks `submitting` + `error` state and
 *     either passes them to a render-prop child or wires them to a
 *     submit-button's `disabled` automatically.
 *   - Throws away page navigation: `onSubmit` calls preventDefault and
 *     fetches via JSON. Themes that want classic POST-and-navigate
 *     can drop down to a plain `<form>`.
 *
 * Refuses to submit to absolute URLs (must point at the storefront
 * itself or an `/api/*` proxy) so a misconfigured theme can't leak
 * customer data to a third party origin.
 */
export function Form({
  action,
  method = "POST",
  onSuccess,
  onError,
  children,
  ...rest
}: FormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (ABSOLUTE_URL.test(action)) {
      const err = new Error(
        `<Form action> must be a same-origin path (got "${action}"). ` +
          `Use a /api/* proxy route or your route handler.`,
      );
      setError(err);
      onError?.(err);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData(e.currentTarget);
      const isMutation = method !== "GET";

      // Convert FormData → JSON. Themes can pass `data-numu-multipart="true"`
      // on the form to opt into multipart instead (file uploads).
      const isMultipart =
        e.currentTarget.dataset?.numuMultipart === "true";

      const headers: Record<string, string> = {};
      if (!isMultipart) headers["Content-Type"] = "application/json";
      if (isMutation) {
        const csrf = readCsrfCookie();
        if (csrf) headers["x-numu-csrf"] = csrf;
        headers["x-numu-idempotency-key"] = newIdempotencyKey();
      }

      let url = action;
      let body: BodyInit | undefined;
      if (method === "GET") {
        const params = new URLSearchParams();
        for (const [k, v] of formData.entries()) {
          if (typeof v === "string") params.append(k, v);
        }
        const sep = action.includes("?") ? "&" : "?";
        url = `${action}${sep}${params.toString()}`;
      } else if (isMultipart) {
        body = formData;
      } else {
        const obj: Record<string, FormDataEntryValue> = {};
        for (const [k, v] of formData.entries()) obj[k] = v;
        body = JSON.stringify(obj);
      }

      const res = await fetch(url, { method, headers, body });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `${method} ${action} failed: ${res.status} ${res.statusText}${
            text ? ` — ${text.slice(0, 200)}` : ""
          }`,
        );
      }
      const json = res.headers
        .get("content-type")
        ?.includes("application/json")
        ? await res.json()
        : await res.text();
      onSuccess?.(json);
    } catch (err) {
      const e2 = err instanceof Error ? err : new Error(String(err));
      setError(e2);
      onError?.(e2);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      method={method}
      action={action}
      aria-busy={submitting}
      {...rest}
    >
      {typeof children === "function"
        ? children({ submitting, error })
        : children}
    </form>
  );
}
