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

// We pin the keys to fixed Symbols on globalThis so ALL copies of this
// SDK module — even when bundled with a BYOT theme — share the same
// well-known keys. This is the same approach React's "internals" use.
const SDK_SYMBOL_KEY = "__NUMU_SDK_SLOT__";
const REACT_SYMBOL_KEY = "__NUMU_REACT_SLOT__";

interface GlobalWithSlots {
  [SDK_SYMBOL_KEY]?: symbol;
  [REACT_SYMBOL_KEY]?: symbol;
}

function globalSlot(name: string, slotKey: keyof GlobalWithSlots): symbol {
  const g = globalThis as unknown as GlobalWithSlots;
  let sym = g[slotKey];
  if (!sym) {
    sym = Symbol.for(name);
    g[slotKey] = sym;
  }
  return sym;
}

function sdkSlot(): symbol {
  return globalSlot("@numueg/theme-sdk:singleton", SDK_SYMBOL_KEY);
}

function reactSlot(): symbol {
  return globalSlot("@numueg/theme-sdk:react", REACT_SYMBOL_KEY);
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
