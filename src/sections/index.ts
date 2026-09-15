/**
 * The NUMU section library — `lib-*` sections every theme can render.
 *
 * A theme opts in with two lines in its registry lookup:
 *
 *   const isKnownType = (t) => Boolean(SECTION_REGISTRY[t]) || isLibrarySection(t);
 *   const Component = SECTION_REGISTRY[instance.type] ?? librarySection(instance.type);
 *
 * Each section is its own chunk, loaded the first time a page renders it, so a
 * store downloads only the sections its pages use and `sdk.js` stays small as
 * the library grows (theme-section-base PHASE-7, Wave 0). Consequences:
 *   - Server rendering must wait for Suspense: `renderToString` renders a lazy
 *     section as empty. The storefront SSR worker uses `prerenderToNodeStream`.
 *   - Each section sits in its own Suspense boundary. During hydration React
 *     keeps the server HTML until the chunk arrives; on a client-only mount the
 *     section appears when its chunk loads.
 *
 * Schemas are not bundled here (the storefront never needs them at runtime);
 * they ship through the `@numueg/theme-sdk/section-library` entry for the API.
 * Plan: docs/Plans/theme-section-base/PHASE-2-SECTION-LIBRARY.md.
 */

import { Suspense, createElement, lazy, type ComponentType } from "react";

import type { SectionInstance } from "../types/theme";

export interface LibrarySectionProps {
  instance: SectionInstance;
  sectionId: string;
}

type SectionModule = { default: ComponentType<LibrarySectionProps> };

// Static import() calls, one per section, so bundlers split each into a chunk.
const LOADERS: Record<string, () => Promise<SectionModule>> = {
  "lib-before-after": () => import("./lib-before-after/BeforeAfter"),
  "lib-bundle-builder": () => import("./lib-bundle-builder/BundleBuilder"),
  "lib-collection-tiles": () => import("./lib-collection-tiles/CollectionTiles"),
  "lib-countdown": () => import("./lib-countdown/Countdown"),
  "lib-faq": () => import("./lib-faq/Faq"),
  "lib-gallery": () => import("./lib-gallery/Gallery"),
  "lib-hero": () => import("./lib-hero/Hero"),
  "lib-image-text": () => import("./lib-image-text/ImageText"),
  "lib-logo-list": () => import("./lib-logo-list/LogoList"),
  "lib-lookbook": () => import("./lib-lookbook/Lookbook"),
  "lib-made-to-order": () => import("./lib-made-to-order/MadeToOrder"),
  "lib-marquee": () => import("./lib-marquee/Marquee"),
  "lib-materials-care": () => import("./lib-materials-care/MaterialsCare"),
  "lib-newsletter": () => import("./lib-newsletter/Newsletter"),
  "lib-process": () => import("./lib-process/Process"),
  "lib-product-rail": () => import("./lib-product-rail/ProductRail"),
  "lib-promo-banner": () => import("./lib-promo-banner/PromoBanner"),
  "lib-rich-text": () => import("./lib-rich-text/RichTextBlock"),
  "lib-shop-the-look": () => import("./lib-shop-the-look/ShopTheLook"),
  "lib-size-guide": () => import("./lib-size-guide/SizeGuide"),
  "lib-store-visit": () => import("./lib-store-visit/StoreVisit"),
  "lib-testimonials": () => import("./lib-testimonials/Testimonials"),
  "lib-trust-strip": () => import("./lib-trust-strip/TrustStrip"),
  "lib-ugc-carousel": () => import("./lib-ugc-carousel/UgcCarousel"),
  "lib-video": () => import("./lib-video/Video"),
};

// One component per type for the life of the page: a new lazy() on every call
// would remount the section and re-suspend on each render.
const components = new Map<string, ComponentType<LibrarySectionProps>>();

/** The library component for `type`, or undefined for any other type. */
export function librarySection(type: string): ComponentType<LibrarySectionProps> | undefined {
  if (!isLibrarySection(type)) return undefined;
  let component = components.get(type);
  if (!component) {
    const Lazy = lazy(LOADERS[type]);
    const LibrarySection = (props: LibrarySectionProps) =>
      createElement(Suspense, { fallback: null }, createElement(Lazy, props));
    LibrarySection.displayName = `LibrarySection(${type})`;
    component = LibrarySection;
    components.set(type, component);
  }
  return component;
}

export function isLibrarySection(type: string): boolean {
  // hasOwnProperty, not `in`: "toString" and friends are not sections.
  return Object.prototype.hasOwnProperty.call(LOADERS, type);
}

/**
 * Start downloading the chunks for these section types, e.g. the ones in the
 * page's template, before React asks for them. Unknown types are ignored.
 */
export function preloadLibrarySections(types: Iterable<string>): Promise<unknown> {
  const loads: Promise<unknown>[] = [];
  for (const type of new Set(types)) {
    if (isLibrarySection(type)) loads.push(LOADERS[type]());
  }
  return Promise.all(loads);
}
