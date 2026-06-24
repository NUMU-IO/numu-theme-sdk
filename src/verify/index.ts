/**
 * Behavioral render-verification harness — theme-enforcement Phase 2.
 *
 * Phase 1 proves a theme MATCHES the contract (structure/manifest/schemas).
 * This proves it TRULY WORKS: it server-renders the built theme against
 * representative fixture data for every required template and fails on any
 * template that throws or renders empty — catching the bugs the structural
 * gate can't (a section that reads `settings.x.y` when x is undefined, an SDK
 * hook used outside its provider, a template that produces no output).
 *
 * This module is React-free at import time: it imports only types and pulls
 * `react-dom/server` dynamically at call time. It runs in Node (the CLI's
 * `verify` command / the build worker) against the theme's `dist/theme.server.js`
 * `createApp(ctx)` export. The theme's own React/SDK (its node_modules) satisfy
 * the bundle's externals.
 */

import type { ReactElement } from "react";
import type { Store, Product, Collection, Cart, Customer } from "../types/entities";
import type { ThemeSettingsV3 } from "../types/theme";
import type { ThemeMountContext } from "../mount";
import { REQUIRED_TEMPLATES } from "../validation";

export { REQUIRED_TEMPLATES };

// ── Fixtures ──────────────────────────────────────────────────────

export function makeFixtureStore(overrides: Partial<Store> = {}): Store {
  return {
    id: "00000000-0000-0000-0000-0000000000fx",
    name: "Fixture Store",
    slug: "fixture-store",
    subdomain: "fixture-store",
    currency: "EGP",
    default_language: "en",
    use_nextjs_storefront: true,
    logo_url: "https://cdn.example.com/logo.png",
    description: "A fixture store for render verification.",
    settings: {},
    ...overrides,
  };
}

export function makeFixtureProduct(i = 1): Product {
  const id = `00000000-0000-0000-0000-00000000p${String(i).padStart(3, "0")}`;
  return {
    id,
    name: `Fixture Product ${i}`,
    slug: `fixture-product-${i}`,
    description: "A representative product for render verification.",
    price: 19900,
    compare_at_price: 24900,
    currency: "EGP",
    images: [
      { id: `${id}-img`, url: "https://cdn.example.com/p.jpg", alt: "Product", position: 0 },
    ],
    options: [{ name: "Size", position: 0, values: ["S", "M", "L"] }],
    variants: [
      {
        id: `${id}-v1`,
        position: 0,
        option_values: { Size: "M" },
        price: 19900,
        compare_at_price: 24900,
        sku: "FX-M",
        inventory_quantity: 25,
        is_in_stock: true,
      },
    ],
    category: "Fixtures",
    tags: ["fixture"],
    in_stock: true,
    attributes: {},
  };
}

export function makeFixtureCollection(): Collection {
  const products = [makeFixtureProduct(1), makeFixtureProduct(2), makeFixtureProduct(3)];
  return {
    id: "00000000-0000-0000-0000-00000000c001",
    name: "Fixture Collection",
    slug: "fixture-collection",
    description: "A representative collection.",
    image_url: "https://cdn.example.com/c.jpg",
    product_count: products.length,
    products,
  };
}

export function makeFixtureCart(): Cart {
  const p = makeFixtureProduct(1);
  return {
    id: "00000000-0000-0000-0000-00000000cart",
    items: [
      {
        id: "ci-1",
        product_id: p.id,
        variant_id: p.variants[0].id,
        name: p.name,
        image_url: p.images[0]?.url,
        price: p.price,
        quantity: 2,
        variant_name: "M",
      },
    ],
    subtotal: p.price * 2,
    total: p.price * 2,
    currency: "EGP",
  };
}

export function makeFixtureCustomer(): Customer {
  return {
    id: "00000000-0000-0000-0000-0000000cust1",
    email: "fixture@example.com",
    first_name: "Fixture",
    last_name: "Buyer",
    phone: "+201000000000",
    orders_count: 3,
    total_spent: 59700,
  };
}

function fixtureThemeSettings(storeId: string): ThemeSettingsV3 {
  // Empty templates → demo mode → the theme renders its own bundled presets
  // (from theme.json), which is exactly what we want to exercise.
  return {
    schema_version: 3,
    theme_id: storeId,
    global_settings: {},
    templates: {},
    section_groups: {},
  } as ThemeSettingsV3;
}

/**
 * Build a complete ThemeMountContext for a template. `page.data` is populated
 * generously (products + collections + a single product + collection) so a
 * section's hooks always have data regardless of which template reads what.
 */
export function makeFixtureContext(
  template: string,
  overrides: Partial<ThemeMountContext> = {},
): ThemeMountContext {
  const store = makeFixtureStore();
  const product = makeFixtureProduct(1);
  const products = [product, makeFixtureProduct(2), makeFixtureProduct(3)];
  const collection = makeFixtureCollection();
  return {
    storeData: store,
    currentTemplate: template,
    page: {
      type: template,
      handle: `${template}-fixture`,
      data: { products, collections: [collection], product, collection },
    },
    themeSettings: fixtureThemeSettings(store.id),
    initialCart: makeFixtureCart(),
    customer: makeFixtureCustomer(),
    locale: "en",
    translations: {},
    navigation: {},
    demo: true,
    ...overrides,
  };
}

// ── Harness ───────────────────────────────────────────────────────

export interface TemplateRenderResult {
  template: string;
  ok: boolean;
  /** Trimmed HTML length produced by the SSR render. */
  htmlLength: number;
  /** Failure reason (throw stack/message, or "empty output"). */
  error?: string;
}

export interface VerifyRenderResult {
  ok: boolean;
  results: TemplateRenderResult[];
}

/** The shape we need from a theme's built server bundle. */
export interface ThemeServerModule {
  createApp?: (ctx: ThemeMountContext) => ReactElement;
}

export interface VerifyRenderOptions {
  /** Templates to render. Defaults to REQUIRED_TEMPLATES. */
  templates?: readonly string[];
  /** Locale to render under (e.g. "ar" to catch RTL/translation crashes). */
  locale?: string;
}

/**
 * Server-render every requested template through the theme's `createApp` and
 * report which ones throw or render empty. Never throws — a render crash is
 * captured as a failed result. `ok` is true only when every template renders
 * non-empty HTML without error.
 */
export async function verifyThemeRender(
  serverModule: ThemeServerModule | null | undefined,
  options: VerifyRenderOptions = {},
): Promise<VerifyRenderResult> {
  const templates = options.templates ?? REQUIRED_TEMPLATES;

  if (!serverModule || typeof serverModule.createApp !== "function") {
    return {
      ok: false,
      results: [
        {
          template: "*",
          ok: false,
          htmlLength: 0,
          error:
            "Theme bundle does not export `createApp` — it cannot be server-rendered. " +
            "Export it via defineThemeEntry() (SDK >= 0.3) and build with federate:true.",
        },
      ],
    };
  }

  // Pulled dynamically so this module stays React-free at import time; resolved
  // from the host/theme node_modules at call time.
  const { renderToStaticMarkup } = (await import("react-dom/server")) as {
    renderToStaticMarkup: (el: ReactElement) => string;
  };

  const results: TemplateRenderResult[] = [];
  for (const template of templates) {
    try {
      const ctx = makeFixtureContext(
        template,
        options.locale ? { locale: options.locale } : {},
      );
      const el = serverModule.createApp(ctx);
      const html = renderToStaticMarkup(el);
      const len = (html || "").trim().length;
      results.push({
        template,
        ok: len > 0,
        htmlLength: len,
        error: len > 0 ? undefined : "rendered empty output",
      });
    } catch (err) {
      results.push({
        template,
        ok: false,
        htmlLength: 0,
        error: err instanceof Error ? err.stack || err.message : String(err),
      });
    }
  }

  return { ok: results.every((r) => r.ok), results };
}
