"use client";
import { useCallback, useState } from "react";

import { useCart } from "./useCart";

/**
 * The discount-code box, minus the markup.
 *
 * Every theme was re-implementing this on top of `applyDiscount`, and every
 * theme got it wrong in a different way, because the mutation REPORTS failure
 * (`{ ok: false, message }`) rather than throwing:
 *
 *   * a `try/catch` around it never fires, so a rejected code cleared the
 *     input and said nothing — the shopper reads that as "codes don't work";
 *   * a hand-rolled success test against invented fields (`res.success`,
 *     `res.code_discount_cents`) matches nothing, so a VALID code reports
 *     failure just as loudly.
 *
 * This hook owns that one decision — did the code apply? — and hands a theme
 * back plain state to render however it likes. `error` carries the backend's
 * own message ("This coupon has expired", "does not apply to this cart"),
 * which is the difference between a shopper fixing their cart and a shopper
 * giving up.
 *
 * @example
 * const dc = useDiscountCode();
 * if (dc.applied) return <Chip code={dc.applied} onRemove={dc.remove} />;
 * return (
 *   <form onSubmit={dc.submit}>
 *     <input value={dc.code} onChange={(e) => dc.setCode(e.target.value)} />
 *     <button disabled={dc.busy}>Apply</button>
 *     {dc.error && <p>{dc.error}</p>}
 *   </form>
 * );
 */
export interface DiscountCodeState {
  /** Current input value. */
  code: string;
  setCode: (value: string) => void;
  /** The code already pinned on the cart, if any. */
  applied: string | null;
  /** The discount the cart currently carries, in MAJOR units. */
  discount: number;
  /** A write is in flight (this hook's or another cart mutation's). */
  busy: boolean;
  /** Why the last apply failed — the backend's message when it sent one. */
  error: string | null;
  /** Apply the typed code. Returns true when it stuck. */
  apply: (code?: string) => Promise<boolean>;
  /** `onSubmit` handler for a <form> wrapper. */
  submit: (event: { preventDefault: () => void }) => void;
  /** Drop the applied code. */
  remove: () => Promise<void>;
}

export function useDiscountCode(
  /** Shown when the backend rejects a code without a message of its own. */
  fallbackError = "This code can't be applied to your cart.",
): DiscountCodeState {
  const { cart, applyDiscount, removeDiscount, loading } = useCart();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    async (value?: string): Promise<boolean> => {
      const next = (value ?? code).trim();
      if (!next || busy) return false;
      setBusy(true);
      setError(null);
      try {
        const result = await applyDiscount(next);
        // `ok` is the write's own verdict — the backend validated the code
        // against the promotion engine before pinning it, so a 2xx here means
        // the cart really carries it. Nothing else needs inferring.
        if (!result?.ok) {
          setError(result?.message || fallbackError);
          return false;
        }
        setCode("");
        return true;
      } finally {
        setBusy(false);
      }
    },
    [applyDiscount, busy, code, fallbackError],
  );

  const submit = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault();
      void apply();
    },
    [apply],
  );

  const remove = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeDiscount();
      setCode("");
    } finally {
      setBusy(false);
    }
  }, [busy, removeDiscount]);

  return {
    code,
    setCode: (value: string) => {
      setCode(value);
      if (error) setError(null);
    },
    applied: cart?.discount_code ?? null,
    discount: cart?.discount_amount ?? 0,
    busy: busy || loading,
    error,
    apply,
    submit,
    remove,
  };
}
