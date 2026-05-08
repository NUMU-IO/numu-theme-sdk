"use client";

import { useCallback } from "react";
import { useShop } from "../hooks/useShop";

/**
 * <CurrencySwitcher /> — placeholder component for multi-currency.
 *
 * v1 ships single-currency presentment (per audit plan: multi-currency
 * is explicitly deferred past v1). This component exists so theme
 * devs can place it in their layouts today without conditional renders;
 * when multi-currency lands, the dropdown will populate from
 * `store.available_currencies` and changing it will set a `numu_ccy`
 * cookie that the storefront and SDK read on subsequent renders.
 *
 * Today's behavior:
 *   - When the store has only one currency, renders nothing (returns
 *     null) — no point showing a 1-option dropdown.
 *   - When the store later exposes `available_currencies`, renders a
 *     proper `<select>` with the active currency selected.
 *   - The `onSelect` callback is called with the new currency code.
 *     v1 has no listener; v2's NuMuProvider will subscribe.
 *
 * Themes can pass a `render` slot to take over the markup completely.
 */

export interface CurrencySwitcherProps {
  className?: string;
  onSelect?: (currency: string) => void;
  /** Custom renderer. Receives the resolved currency list + current selection. */
  render?: (state: {
    currencies: string[];
    current: string;
    onChange: (next: string) => void;
  }) => React.ReactNode;
}

export function CurrencySwitcher({
  className,
  onSelect,
  render,
}: CurrencySwitcherProps) {
  const shop = useShop();
  // Reserved on the Store entity — populated when multi-currency lands.
  const list =
    (shop as unknown as { available_currencies?: string[] })
      .available_currencies || [];
  const current = shop.currency;

  const handleChange = useCallback(
    (next: string) => {
      if (next === current) return;
      onSelect?.(next);
      // Persist the selection so subsequent navigations keep it.
      // Read by NuMuProvider on mount once multi-currency lands.
      if (typeof document !== "undefined") {
        const oneYear = 60 * 60 * 24 * 365;
        document.cookie = `numu_ccy=${encodeURIComponent(next)}; path=/; max-age=${oneYear}; samesite=lax`;
      }
    },
    [current, onSelect],
  );

  // No alternatives configured → render nothing. Theme code can still
  // reference this component without a runtime check.
  if (!list.length || (list.length === 1 && list[0] === current)) {
    return null;
  }

  if (render) {
    return <>{render({ currencies: list, current, onChange: handleChange })}</>;
  }

  return (
    <select
      className={className ?? "numu-currency-switcher"}
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Currency"
    >
      {list.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
