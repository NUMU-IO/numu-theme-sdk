// @vitest-environment node
/**
 * Section library — registry, schema contract, pure helpers and SSR. Runs
 * under plain Node, like the storefront's SSR worker, inside the real provider
 * stack (`defineThemeEntry`), so any render-path DOM access fails here first.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { describe, expect, it, vi } from "vitest";

import { defineThemeEntry } from "../entry";
import type { ThemeMountContext } from "../mount";
import type { Store } from "../types/entities";
import type { BlockSchema, SectionInstance, ThemeSettingsV3 } from "../types/theme";
import { isLibrarySection, librarySection } from "../sections";
import { sectionLibraryCatalog } from "../sections/catalog";
import { keyboardPosition } from "../sections/lib-before-after/BeforeAfter";
import {
  autoplayAllowed,
  createPrepareGate,
  productKeyFromLink,
  releaseOnMetadata,
  resolveVideoEmbed,
} from "../sections/lib-ugc-carousel/media";
import type { LibrarySettingDivider } from "../sections/types";

const here = dirname(fileURLToPath(import.meta.url));

interface RenderOptions {
  locale?: string;
  copies?: number;
  products?: unknown[];
  collections?: unknown[];
  instance?: Partial<SectionInstance>;
}

async function render(type: string, settings: Record<string, unknown>, { locale = "en", copies = 1, products = [], collections = [], instance: extra }: RenderOptions = {}) {
  const Component = librarySection(type);
  if (!Component) throw new Error(`no library section ${type}`);
  const instance = { type, settings, ...extra } as SectionInstance;
  const entry = defineThemeEntry(() =>
    createElement(
      "main",
      null,
      ...Array.from({ length: copies }, (_, i) =>
        createElement(Component, { key: i, instance, sectionId: `${type}-${i}` }),
      ),
    ),
  );
  const ctx = {
    themeSettings: {
      schema_version: 3,
      theme_id: "library-fixture",
      global_settings: {},
      templates: {},
      section_groups: {},
    } as unknown as ThemeSettingsV3,
    // Same store shape as ssr.test.ts: a Next.js storefront with page data
    // already present, so providers never fetch.
    storeData: {
      id: "s1",
      name: "Store",
      slug: "store",
      currency: "EGP",
      default_language: locale,
      use_nextjs_storefront: true,
    } as Store,
    page: { type: "home", data: { products, collections } },
    locale,
    demo: false,
    navigation: {},
  } as ThemeMountContext;
  // Library sections are lazy chunks: renderToString would render them empty.
  // prerenderToNodeStream waits for Suspense, like the storefront SSR worker.
  const { prelude } = await prerenderToNodeStream(entry.createApp(ctx), {
    // Inline boundaries, as the storefront worker renders them (no $RC scripts).
    progressiveChunkSize: Number.MAX_SAFE_INTEGER,
  });
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}

const isDivider = (s: unknown): s is LibrarySettingDivider =>
  typeof s === "object" && s !== null && !("id" in s);

/** Every component file of a library section, concatenated. */
function componentSource(type: string): string {
  const dir = join(here, "../sections", type);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => readFileSync(join(dir, f), "utf-8"))
    .join("\n");
}

function expectArabicBlocks(blocks: BlockSchema[] | undefined) {
  for (const block of blocks ?? []) {
    expect(block.locales?.ar?.name, block.type).toBeTruthy();
    for (const s of block.settings) expect(s.locales?.ar?.label, `${block.type}.${s.id}`).toBeTruthy();
    expectArabicBlocks(block.blocks);
  }
}

describe("library registry", () => {
  it("resolves every catalog type, and only real keys", () => {
    for (const type of Object.keys(sectionLibraryCatalog)) {
      expect(isLibrarySection(type)).toBe(true);
      expect(librarySection(type)).toBeTypeOf("function");
    }
    expect(isLibrarySection("toString")).toBe(false);
    expect(librarySection("vionne-image-comparison")).toBeUndefined();
  });

  it("uses lib- prefixed types only", () => {
    for (const type of Object.keys(sectionLibraryCatalog)) expect(type).toMatch(/^lib-[a-z0-9-]+$/);
  });
});

describe("library schemas", () => {
  for (const schema of Object.values(sectionLibraryCatalog)) {
    describe(schema.type, () => {
      it("has Arabic for the section, presets, blocks, every label, info and divider", async () => {
        expect(schema.locales?.ar?.name).toBeTruthy();
        for (const preset of schema.presets ?? []) {
          expect(preset.locales?.ar?.name).toBeTruthy();
          expect(preset.category).toBeTruthy();
        }
        for (const s of schema.settings) {
          if (isDivider(s)) {
            expect(s.locales?.ar?.content, s.content).toBeTruthy();
            continue;
          }
          expect(s.locales?.ar?.label, s.id).toBeTruthy();
          if (s.info) expect(s.locales?.ar?.info, s.id).toBeTruthy();
          for (const o of s.options ?? []) expect(o.label_ar, `${s.id}:${o.value}`).toBeTruthy();
        }
        expectArabicBlocks(schema.blocks);
      });

      it("declares exactly the section settings the component reads", async () => {
        const source = componentSource(schema.type);
        const declared = new Set(
          schema.settings.filter((s) => !isDivider(s)).map((s) => (s as { id: string }).id),
        );
        const read = new Set([...source.matchAll(/\bs\.([a-z0-9_]+)/g)].map((m) => m[1]));
        // Numbered settings read through a template, e.g. s[`item_${i}_media`].
        const templates = [...source.matchAll(/\bs\[`([a-z0-9_]*)\$\{i\}([a-z0-9_]*)`\]/g)].map(
          (m) => new RegExp(`^${m[1]}\\d+${m[2]}$`),
        );
        for (const id of declared) if (templates.some((t) => t.test(id))) read.add(id);
        expect([...read].sort()).toEqual([...declared].sort());
      });
    });
  }
});

describe("lib-before-after", () => {
  it("renders the empty state and hoists one style per section type", async () => {
    const html = await render("lib-before-after", {}, { copies: 2 });
    expect(html).toContain("lib-ba-empty");
    // React 19 merges same-precedence styles into one tag whose data-href
    // lists every id: data-href="lib-base lib-before-after".
    const hrefs = [...html.matchAll(/data-href="([^"]*)"/g)].flatMap((m) => m[1].split(" "));
    expect(hrefs.filter((h) => h === "lib-before-after")).toHaveLength(1);
    expect(hrefs.filter((h) => h === "lib-base")).toHaveLength(1);
  });

  it("speaks Arabic when the store locale is Arabic", async () => {
    const html = await render("lib-before-after", {}, { locale: "ar" });
    expect(html).toContain("قبل");
    expect(html).toContain("بعد");
  });

  it("routes platform images through the proxy and leaves others alone", async () => {
    const html = await render("lib-before-after", {
      before_image: { url: "https://cdn.numueg.app/a.jpg" },
      after_image: "https://picsum.photos/800",
      before_label: "Before",
      after_label: "After",
      show_labels: true,
    });
    expect(html).toContain("/api/image-transform");
    expect(html).toContain('src="https://picsum.photos/800"');
    expect(html).toContain("lib-ba-label--before");
    expect(html).toContain('role="slider"');
  });

  it("keeps a garbage start position on the page", async () => {
    const html = await render("lib-before-after", { after_image: "/x.jpg", initial_position: "abc", animate_to_center: false });
    expect(html).toContain('aria-valuenow="50"');
  });

  it("moves the handle toward the arrow's side in both directions", () => {
    expect(keyboardPosition(50, "ArrowRight", false, false)).toBe(52);
    expect(keyboardPosition(50, "ArrowRight", false, true)).toBe(48);
    expect(keyboardPosition(50, "ArrowLeft", true, false)).toBe(40);
    expect(keyboardPosition(99, "ArrowRight", true, false)).toBe(100);
    expect(keyboardPosition(30, "Home", false, true)).toBe(0);
    expect(keyboardPosition(30, "Enter", false, false)).toBeNull();
  });
});

describe("lib-ugc-carousel helpers", () => {
  it("reads product keys from /products/ and legacy /product/ links only", () => {
    expect(productKeyFromLink("/products/sponge-taupe")).toBe("sponge-taupe");
    expect(productKeyFromLink("/product/abc?ref=reel")).toBe("abc");
    expect(productKeyFromLink("https://vionneeg.com/products/%D8%B4%D8%A7%D9%84")).toBe("شال");
    expect(productKeyFromLink("/collections/printed-modal")).toBeUndefined();
    expect(productKeyFromLink("/products/%E0%A4%A")).toBeUndefined();
  });

  it("asks embeds to autoplay only when allowed", () => {
    const yt = (autoplay: boolean) => resolveVideoEmbed("https://www.youtube.com/watch?v=abc123", { autoplay });
    expect(yt(false)).toMatchObject({ kind: "iframe", provider: "youtube" });
    expect(yt(false)?.src).not.toContain("autoplay=1");
    expect(yt(false)?.src).toContain("controls=1");
    expect(yt(true)?.src).toContain("autoplay=1");
    expect(resolveVideoEmbed("https://vimeo.com/123456", { autoplay: false })?.src).not.toContain("background=1");
    expect(resolveVideoEmbed("https://vimeo.com/123456", { autoplay: true })?.src).toContain("autoplay=1");
    expect(resolveVideoEmbed("https://www.facebook.com/watch/?v=1", { autoplay: false })?.src).toContain("autoplay=false");
  });

  it("resolves files, posters, Instagram, and treats empty values as no video", () => {
    expect(resolveVideoEmbed({ url: "https://cdn.numueg.app/r.mp4", poster: { url: "/p.jpg" } }, { autoplay: false })).toEqual({
      kind: "file",
      src: "https://cdn.numueg.app/r.mp4",
      poster: "/p.jpg",
    });
    expect(resolveVideoEmbed({ url: "" }, { autoplay: true })).toBeNull();
    expect(resolveVideoEmbed("https://www.instagram.com/reels/XYZ/", { autoplay: false })?.src).toBe(
      "https://www.instagram.com/reel/XYZ/embed",
    );
    expect(resolveVideoEmbed("https://example.com/page", { autoplay: false })).toBeNull();
  });

  it("withholds autoplay for reduced motion, Save-Data, 2G and the server", () => {
    const env = (reduce: boolean, connection?: { saveData?: boolean; effectiveType?: string }) => ({
      matchMedia: () => ({ matches: reduce }),
      navigator: { connection },
    });
    expect(autoplayAllowed(undefined)).toBe(false);
    expect(autoplayAllowed(env(true))).toBe(false);
    expect(autoplayAllowed(env(false, { saveData: true }))).toBe(false);
    expect(autoplayAllowed(env(false, { effectiveType: "slow-2g" }))).toBe(false);
    expect(autoplayAllowed(env(false, { effectiveType: "4g" }))).toBe(true);
  });

  it("frees a prewarm slot at once when the reel already has metadata", () => {
    const withSlot = createPrepareGate(2);
    const started: number[] = [];
    const media = (readyState: number) => ({ readyState, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    // Reels 1 and 2 were attached by hover/autoplay meanwhile: metadata is in.
    withSlot((release) => {
      started.push(1);
      releaseOnMetadata(media(1), release);
    });
    withSlot((release) => {
      started.push(2);
      releaseOnMetadata(media(1), release);
    });
    // A fresh reel still waits for its event, so it holds its slot.
    const fresh = media(0);
    withSlot((release) => {
      started.push(3);
      releaseOnMetadata(fresh, release);
    });
    withSlot(() => started.push(4));
    expect(started).toEqual([1, 2, 3, 4]);
    expect(fresh.addEventListener).toHaveBeenCalledWith("loadedmetadata", expect.any(Function));
  });
});

describe("lib-ugc-carousel", () => {
  // Vionne's live instance (sec_4298e6ea, 2026-09-14): three uploaded reels,
  // an empty fourth video, collection links, no posters, autoplay never saved.
  const vionneLive = {
    title: "Build Your Perfect Scarf Wardrobe",
    subtitle: "Why stop at one shade?",
    cta_link: "/products",
    item_1_video: { url: "https://cdn.numueg.app/customization/r1.mp4" },
    item_1_product_link: "/collections/printed-modal",
    item_2_video: { url: "https://cdn.numueg.app/customization/r2.mp4" },
    item_2_product_link: "/collections/modal-cotton",
    item_3_video: { url: "https://cdn.numueg.app/customization/r3.mp4" },
    item_3_product_link: "/collections/sponge",
    item_4_video: { url: "" },
  };

  it("renders Vionne's live data: three reels, no src at mount, collection links kept", async () => {
    const html = await render("lib-ugc-carousel", vionneLive);
    expect(html.match(/<video/g)).toHaveLength(3);
    expect(html).not.toMatch(/<video[^>]*\ssrc=/);
    expect(html.match(/href="\/collections\//g)).toHaveLength(3);
    expect(html).toContain("Shop now");
    // Collection links carry no product name (the CSS rule for the class is in
    // the hoisted <style>, so assert on the element, not the text).
    expect(html).not.toContain('class="lib-ugc-name"');
    expect(html).toContain("Build Your Perfect Scarf Wardrobe");
    // Cards stay visible until JS arms the reveal: no data-visible on the track.
    expect(html).toContain('<div class="lib-ugc-track">');
  });

  it("renders nothing on the storefront without reels", async () => {
    expect(await render("lib-ugc-carousel", { title: "Tagged by you", item_1_video: { url: "" } })).not.toContain('class="lib-section');
  });

  it("uses neutral Egyptian Arabic defaults", async () => {
    const html = await render("lib-ugc-carousel", { item_1_video: "https://cdn.numueg.app/r.mp4" }, { locale: "ar" });
    expect(html).toContain("صوّرتونا");
    expect(html).toContain("شغّل الفيديو 1");
  });

  it("names the tagged product from the catalog and uses its photo as the chip", async () => {
    const products = [{ id: "p1", slug: "sponge-taupe", name: "Sponge Taupe", images: [{ url: "https://cdn.numueg.app/p.jpg" }] }];
    const html = await await render(
      "lib-ugc-carousel",
      { item_1_video: "https://cdn.numueg.app/r.mp4", item_1_product_link: "/products/sponge-taupe" },
      { products },
    );
    expect(html).toContain("Sponge Taupe");
    expect(html).toContain('class="lib-ugc-chip"');
  });

  it("server-renders embeds without autoplay even when the setting is on", async () => {
    const html = await render("lib-ugc-carousel", { autoplay: true, item_1_video: "https://youtu.be/abc123" });
    expect(html).toContain("youtube-nocookie.com/embed/abc123");
    expect(html).not.toContain("autoplay=1");
  });
});

describe("lib-promo-banner", () => {
  it("renders the offer card from a headline, with or without an image", async () => {
    const html = await render("lib-promo-banner", { style: "split", overlay_text: "Eid sale", badge_text: "Limited", subtitle: "Up to 30%" });
    expect(html).toContain('class="lib-section lib-offer"');
    expect(html).toContain('class="lib-offer-badge">Limited');
    expect(html).toContain('href="/products" class="lib-offer-cta">Shop now');
    expect(html).not.toContain('class="lib-offer-media"');
    expect(await render("lib-promo-banner", { style: "split", image: "/b.jpg" })).not.toContain('class="lib-section');
  });

  it("renders nothing on the storefront without an image", async () => {
    expect(await render("lib-promo-banner", { overlay_text: "Sale" })).not.toContain('class="lib-section');
  });

  it("uses a native mobile source and a scrim only when there is copy", async () => {
    const withCopy = await render("lib-promo-banner", {
      image: "https://cdn.numueg.app/wide.jpg",
      image_mobile: "https://cdn.numueg.app/tall.jpg",
      overlay_text: "Eid collection",
      cta_text: "Shop",
      text_position: "bottom-end",
    });
    expect(withCopy).toContain('<source media="(max-width: 768px)"');
    expect(withCopy).toContain('class="lib-banner-scrim"');
    expect(withCopy).toContain("lib-banner-copy is-bottom-end");
    expect(withCopy).toContain('href="/products"');

    const photoOnly = await render("lib-promo-banner", { image: "https://cdn.numueg.app/wide.jpg" });
    expect(photoOnly).not.toContain('class="lib-banner-scrim"');
    expect(photoOnly).toContain("lib-banner is-medium");
  });
});

describe("lib-testimonials", () => {
  it("renders nothing on the storefront until a review has a name and text", async () => {
    expect(await render("lib-testimonials", { review_1_name: "Mona" })).not.toContain('class="lib-section');
  });

  it("alternates sides and uses Arabic quotation marks for Arabic stores", async () => {
    const settings = { review_1_name: "منى", review_1_text: "تحفة", review_2_name: "كريم", review_2_text: "ممتاز", review_2_city: "طنطا" };
    const html = await render("lib-testimonials", settings, { locale: "ar" });
    expect(html.match(/<blockquote/g)).toHaveLength(2);
    expect(html).toContain("lib-quote is-end");
    expect(html).toContain("«");
    expect(html).toContain("طنطا");
    expect(html).toContain("آراء عملائنا");
  });

  it("renders cards with star ratings, and hides stars for a 0 rating", async () => {
    const html = await render("lib-testimonials", {
      style: "cards",
      review_1_name: "Mona", review_1_text: "Great fit", review_1_rating: 4,
      review_2_name: "Karim", review_2_text: "Fast", review_2_rating: 0,
    });
    expect(html).toContain('class="lib-section lib-quotes is-cards"');
    expect(html.match(/class="lib-rev"/g)).toHaveLength(2);
    expect(html.match(/class="lib-rev-stars"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="4 out of 5 stars"');
    expect(html.match(/class="lib-rev-star is-off"/g)).toHaveLength(1);
  });
});

describe("lib-faq", () => {
  const blocks = {
    instance: {
      blocks: {
        g1: {
          type: "group",
          settings: { title: "Shipping" },
          // Not key order: the merchant moved the Aswan question to the top.
          block_order: ["q2", "q1", "q3"],
          blocks: {
            q1: { type: "qa", settings: { question: "How long does delivery take?", answer: "2–4 days." } },
            q2: { type: "qa", settings: { question: "Do you ship to Aswan?", answer: "Yes." } },
            q3: { type: "qa", settings: { question: "", answer: "orphan" } },
          },
        },
        g2: { type: "group", settings: { title: "Empty" } },
      },
      block_order: ["g1", "g2"],
    } as Partial<SectionInstance>,
  };

  it("renders nothing on the storefront without questions", async () => {
    expect(await render("lib-faq", {})).not.toContain('class="lib-section');
  });

  it("renders questions as details with FAQPage microdata", async () => {
    const html = await render("lib-faq", {}, blocks);
    expect(html).toContain('itemType="https://schema.org/FAQPage"');
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html.indexOf("Do you ship to Aswan?")).toBeLessThan(html.indexOf("How long does delivery take?"));
    expect(html).toContain("Shipping");
    expect(html).not.toContain("orphan");
    expect(html).not.toContain("Empty");
    expect(html).toContain("<h2");
    expect(html).not.toContain("<h1");
  });

  it("hides group headings when asked and localizes the default heading", async () => {
    const html = await render("lib-faq", { show_group_headings: false }, { ...blocks, locale: "ar" });
    expect(html).not.toContain('class="lib-faq-group-title"');
    expect(html).toContain("الأسئلة الشائعة");
  });
});

describe("lib-process", () => {
  it("renders nothing on the storefront without steps", async () => {
    expect(await render("lib-process", { title: "How we work", step_1_image: "/a.jpg" })).not.toContain('class="lib-section');
  });

  it("numbers filled steps in order, with Arabic-Indic numerals for Arabic stores", async () => {
    const html = await render("lib-process", { step_2_title: "بنقصّ القماش", step_4_text: "بنغلّف الطلب" }, { locale: "ar" });
    expect(html.match(/<li /g)).toHaveLength(2);
    expect(html).toContain(">١</span>");
    expect(html).toContain(">٢</span>");
    expect(html).toContain("بنشتغل إزاي");
  });
});

describe("lib-store-visit", () => {
  const shop = {
    address: "12 Nile St, Mansoura",
    hours: "10:00 - 22:00",
    phone: "010 1234 5678",
    whatsapp: "010 1234 5678",
    map_link: "https://maps.app.goo.gl/abc",
  };

  it("renders nothing on the storefront without an address", async () => {
    expect(await render("lib-store-visit", { phone: shop.phone })).not.toContain('class="lib-section');
  });

  it("falls back to the other language's address and keeps numbers in LTR order", async () => {
    const html = await render("lib-store-visit", shop, { locale: "ar" });
    expect(html).toContain("12 Nile St, Mansoura");
    expect(html).toContain("زورنا في المحل");
    expect(html).toContain('itemType="https://schema.org/Store"');
    expect(html).toContain('<span dir="auto">10:00 - 22:00</span>');
    expect(html).toContain('href="https://wa.me/201012345678"');
    expect(html).toContain('href="tel:01012345678" class="lib-visit-phone" dir="ltr"');
    expect(html).toContain("افتح الخريطة");
    expect(html).toContain("كلّمنا على واتساب");
  });

  it("hides the directions button when asked", async () => {
    const html = await render("lib-store-visit", { ...shop, show_directions_button: false });
    expect(html).not.toContain("maps.app.goo.gl");
    expect(html).toContain("wa.me");
  });
});

describe("lib-lookbook", () => {
  it("renders nothing on the storefront until a look has an image", async () => {
    expect(await render("lib-lookbook", { look_1_caption: "Linen" })).not.toContain('class="lib-section');
  });

  it("alternates wide and narrow looks, links whole figures and skips looks without an image", async () => {
    const html = await render("lib-lookbook", {
      look_1_image: "https://cdn.numueg.app/1.jpg",
      look_1_caption: "Linen, worn loose",
      look_1_link: "/products/linen",
      look_2_caption: "caption without a photo",
      look_3_image: { url: "https://cdn.numueg.app/3.jpg", alt: "Evening coat" },
    });
    expect(html.match(/<figure/g)).toHaveLength(2);
    expect(html).toContain('href="/products/linen" class="lib-look is-wide"');
    expect(html).toContain('<div class="lib-look is-narrow">');
    expect(html).toContain("Shop the look");
    expect(html).toContain('alt="Evening coat"');
    expect(html).not.toContain("caption without a photo");
  });
});

describe("lib-collection-tiles", () => {
  it("card style shows a count pill only for counted collections; circles style rounds the image", async () => {
    const counted = [
      { id: "c1", name: "Wide leg", slug: "wide-leg", image_url: "https://cdn.numueg.app/w.jpg", product_count: 4 },
      { id: "c2", name: "Flare", slug: "flare", product_count: 0 },
    ];
    const card = await render("lib-collection-tiles", { style: "card" }, { collections: counted });
    expect(card).toContain('class="lib-section lib-tiles is-card is-portrait"');
    expect(card.match(/class="lib-tile-count"/g)).toHaveLength(1);
    expect(card).toContain('class="lib-tile-count">4 items');
    expect(card.match(/class="lib-tile-card"/g)).toHaveLength(2);
    const circles = await render("lib-collection-tiles", { style: "circles", show_counts: false, label_position: "overlay" }, { collections: counted });
    expect(circles).toContain('class="lib-section lib-tiles is-circles is-portrait"');
    expect(circles).not.toContain('class="lib-tile-sub"');
  });

  const collections = [
    { id: "c1", name: "Wide leg", slug: "wide-leg", image_url: "https://cdn.numueg.app/w.jpg", product_count: 4 },
    { id: "c2", name: "Flare", slug: "flare", product_count: 2 },
  ];

  it("renders nothing on the storefront without collections or tiles", async () => {
    expect(await render("lib-collection-tiles", {})).not.toContain('class="lib-section');
  });

  it("links the store's collections by default, image or not", async () => {
    const html = await render("lib-collection-tiles", { limit: 8 }, { collections });
    expect(html).toContain('href="/collections/wide-leg" class="lib-tile"');
    expect(html).toContain('href="/collections/flare" class="lib-tile"');
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain("Shop by category");
    expect(html).toContain('href="/collections" class="lib-tiles-all"');
  });

  it("uses the merchant's tiles in their order when the source is manual", async () => {
    const html = await render("lib-collection-tiles", { source: "manual", aspect: "square", label_position: "overlay", view_all_link: "" }, {
      collections,
      instance: {
        blocks: {
          a: { type: "tile", settings: { label: "Second", link: "/collections/b" } },
          b: { type: "tile", settings: { label: "First", link: "/collections/a" } },
          c: { type: "tile", disabled: true, settings: { label: "Hidden" } },
        },
        block_order: ["b", "a", "c"],
      } as Partial<SectionInstance>,
    });
    expect(html.indexOf("First")).toBeLessThan(html.indexOf("Second"));
    expect(html).not.toContain("Hidden");
    expect(html).not.toContain("Wide leg");
    expect(html).toContain('class="lib-section lib-tiles is-tiles is-square is-overlay"');
    // Match the class attribute: the section's CSS text is in the HTML too.
    expect(html).not.toContain('class="lib-tiles-all"');
  });

  it("uses Egyptian Arabic defaults for Arabic stores", async () => {
    const html = await render("lib-collection-tiles", {}, { collections, locale: "ar" });
    expect(html).toContain("تسوّق حسب التصنيف");
    expect(html).toContain("شوف الكل");
  });
});

describe("lib-marquee", () => {
  it("loops the typed lines twice with separators, hiding the copy from screen readers", async () => {
    const html = await render("lib-marquee", { item_1: "Free shipping", item_3: "COD", separator: "star" });
    expect(html).toContain('class="lib-section lib-marquee is-band is-accent is-sm pause-hover"');
    expect(html).toContain('aria-label="Free shipping · COD"');
    expect(html.match(/<div class="lib-mq-track"/g)).toHaveLength(2);
    expect(html).toContain('<div class="lib-mq-track" aria-hidden="true">');
    expect(html).toContain("★");
  });

  it("never renders an empty strip, and uses Arabic defaults for Arabic stores", async () => {
    expect(await render("lib-marquee", {})).toContain("Cash on delivery");
    expect(await render("lib-marquee", { style: "statement" }, { locale: "ar" })).toContain("معمول عشان يتلبس كل يوم.");
  });

  it("applies style defaults, direction and a clamped speed", async () => {
    const html = await render("lib-marquee", { style: "statement", direction: "right", speed_seconds: 999, item_1: "Real denim" });
    expect(html).toContain('class="lib-section lib-marquee is-statement is-none is-xl is-right pause-hover"');
    expect(html).toContain("--lib-mq-dur:120s");
    expect(html).not.toContain('class="lib-mq-sep"');
  });
});
