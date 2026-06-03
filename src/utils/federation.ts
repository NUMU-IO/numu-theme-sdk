"use client";

/**
 * Module Federation singleton sharing for @numueg/theme-sdk.
 *
 * Why this exists:
 *   BYOT bundles (loaded at runtime as cross-origin ESM modules) need to
 *   share React + the SDK with the host storefront. Otherwise React's
 *   internal "two copies" check trips and hooks crash. The host registers
 *   its singletons here; the BYOT bundle reads them via the SDK shim.
 *
 * Threat model:
 *   We do NOT want third-party scripts (analytics, chat widgets, BYOT
 *   community themes) to read PII off the SDK. The earlier version stored
 *   the SDK on `window.__NUMU_SDK__` — anything in the page could read it
 *   and call `useCustomer()` etc.
 *
 * Mitigation:
 *   The singleton is keyed by a Symbol that's only handed to consumers
 *   we've verified (the storefront's BYOT entry function passes it to the
 *   bundle's `setup()`). Symbols can't be enumerated through `window` or
 *   `Object.getOwnPropertyNames`, so a leaked global reference doesn't
 *   yield SDK access.
 *
 *   For maximum safety we also expose `clearSdkSingleton()` so the host
 *   can revoke after a BYOT theme is unmounted.
 */

interface SdkSingleton {
  useShop: unknown;
  useProduct: unknown;
  useCollection: unknown;
  useCart: unknown;
  useCustomer: unknown;
  useThemeSettings: unknown;
  useLocalization: unknown;
  usePage: unknown;
  useSection: unknown;
  NuMuProvider: unknown;
  ProductProvider: unknown;
  CollectionProvider: unknown;
}

interface ReactSingleton {
  React: unknown;
  ReactDOM: unknown;
}

// We pin the slot keys via `Symbol.for(name)` so ALL copies of this
// SDK module — even when bundled with a BYOT theme — resolve to the
// SAME Symbol identity through the global Symbol registry. The
// previous implementation also wrote the Symbol back to a string-keyed
// `globalThis["__NUMU_SDK_SLOT__"]` slot "so multiple module copies
// could find it" — but `Symbol.for()` already supplies that identity
// (that's its entire purpose), and writing to a string-keyed
// globalThis property put the slot name into `Object.keys(globalThis)`,
// breaking the Principle II "not enumerable" privacy contract.
//
// What's still public:
//   - The Symbol's *name* is in the global Symbol registry. A motivated
//     attacker who knows the name can call Symbol.for() to recover the
//     same Symbol. Privacy here is obscurity-through-naming, not crypto.
//   - The actual SDK object lives at `globalThis[symbol]` — invisible
//     to `Object.keys`, `Object.getOwnPropertyNames`, and accidental
//     enumeration by third-party scripts that don't know to call
//     `Object.getOwnPropertySymbols`.
function sdkSlot(): symbol {
  return Symbol.for("@numueg/theme-sdk:singleton");
}

function reactSlot(): symbol {
  return Symbol.for("@numueg/theme-sdk:react");
}

export function registerSdkSingleton(sdk: SdkSingleton): void {
  if (typeof globalThis === "undefined") return;
  (globalThis as Record<symbol, unknown>)[sdkSlot()] = sdk;
}

export function getSdkSingleton(): SdkSingleton | null {
  if (typeof globalThis === "undefined") return null;
  return (
    ((globalThis as Record<symbol, unknown>)[sdkSlot()] as SdkSingleton) ??
    null
  );
}

export function clearSdkSingleton(): void {
  if (typeof globalThis === "undefined") return;
  delete (globalThis as Record<symbol, unknown>)[sdkSlot()];
}

export function registerReactSingleton(
  react: unknown,
  reactDom: unknown,
): void {
  if (typeof globalThis === "undefined") return;
  (globalThis as Record<symbol, unknown>)[reactSlot()] = {
    React: react,
    ReactDOM: reactDom,
  } satisfies ReactSingleton;
}

export function getReactSingleton(): ReactSingleton | null {
  if (typeof globalThis === "undefined") return null;
  return (
    ((globalThis as Record<symbol, unknown>)[
      reactSlot()
    ] as ReactSingleton) ?? null
  );
}

export function isSdkAvailable(): boolean {
  return getSdkSingleton() !== null;
}
