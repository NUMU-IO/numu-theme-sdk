"use client";

import { useCallback } from "react";
import { useCurrency } from "../hooks/useCurrency";

/**
 * <CurrencySwitcher /> — wired in Phase 6.
 *
 * Reads presentment currencies + the persisted selection from
 * `useCurrency()`, which talks to
 * `/api/storefront/store/{id}/currencies`. Changing the dropdown
 * writes the `numu_currency` cookie via the hook, which then
 * propagates to `<Money>`'s display.
 *
 * Renders nothing when the store offers only one currency — themes
 * can drop the component into a layout without conditional render.
 *
 * Pass `render` to take over the markup completely (e.g. a custom
 * dropdown component or a flag-icon grid).
 */

export interface CurrencySwitcherProps {
  className?: string;
  onSelect?: (currency: string) => void;
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
  const { presentment, selected, setSelected, loading } = useCurrency();

  const handleChange = useCallback(
    (next: string) => {
      if (next === selected) return;
      setSelected(next);
      onSelect?.(next);
    },
    [selected, setSelected, onSelect],
  );

  // No alternatives, or still loading the list. We don't want to
  // briefly flash a 1-option dropdown while the API resolves.
  if (loading) return null;
  if (presentment.length <= 1) return null;

  if (render) {
    return (
      <>
        {render({
          currencies: presentment,
          current: selected,
          onChange: handleChange,
        })}
      </>
    );
  }

  return (
    <select
      className={className ?? "numu-currency-switcher"}
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Currency"
    >
      {presentment.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
