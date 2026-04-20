"use client";

/**
 * Module Federation singleton sharing for @numu/theme-sdk.
 * Ensures BYOT themes use the same SDK instance as the host storefront.
 */

const SDK_KEY = "__NUMU_SDK__";
const REACT_KEY = "__NUMU_REACT__";

interface SdkSingleton {
  useShop: any;
  useProduct: any;
  useCollection: any;
  useCart: any;
  useCustomer: any;
  useThemeSettings: any;
  useLocalization: any;
  usePage: any;
  useSection: any;
  NuMuProvider: any;
  ProductProvider: any;
  CollectionProvider: any;
}

export function registerSdkSingleton(sdk: SdkSingleton): void {
  if (typeof window !== "undefined") {
    (window as any)[SDK_KEY] = sdk;
  }
}

export function getSdkSingleton(): SdkSingleton | null {
  if (typeof window !== "undefined") {
    return (window as any)[SDK_KEY] || null;
  }
  return null;
}

export function registerReactSingleton(react: any, reactDom: any): void {
  if (typeof window !== "undefined") {
    (window as any)[REACT_KEY] = { React: react, ReactDOM: reactDom };
  }
}

export function getReactSingleton(): { React: any; ReactDOM: any } | null {
  if (typeof window !== "undefined") {
    return (window as any)[REACT_KEY] || null;
  }
  return null;
}

export function isSdkAvailable(): boolean {
  return typeof window !== "undefined" && !!(window as any)[SDK_KEY];
}
