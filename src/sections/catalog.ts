/**
 * `@numueg/theme-sdk/section-library` — the library's schemas, keyed by type.
 *
 * Build-time data for the API (vendored as `dist/section-library.json`), not
 * runtime code: nothing in the SDK root imports this file, so no schema text
 * lands in the storefront's `sdk.js`.
 */

import { beforeAfterSchema } from "./lib-before-after/schema";
import { bundleBuilderSchema } from "./lib-bundle-builder/schema";
import { collectionTilesSchema } from "./lib-collection-tiles/schema";
import { countdownSchema } from "./lib-countdown/schema";
import { faqSchema } from "./lib-faq/schema";
import { gallerySchema } from "./lib-gallery/schema";
import { heroSchema } from "./lib-hero/schema";
import { imageTextSchema } from "./lib-image-text/schema";
import { logoListSchema } from "./lib-logo-list/schema";
import { lookbookSchema } from "./lib-lookbook/schema";
import { madeToOrderSchema } from "./lib-made-to-order/schema";
import { marqueeSchema } from "./lib-marquee/schema";
import { materialsCareSchema } from "./lib-materials-care/schema";
import { newsletterSchema } from "./lib-newsletter/schema";
import { processSchema } from "./lib-process/schema";
import { productRailSchema } from "./lib-product-rail/schema";
import { promoBannerSchema } from "./lib-promo-banner/schema";
import { richTextSchema } from "./lib-rich-text/schema";
import { shopTheLookSchema } from "./lib-shop-the-look/schema";
import { sizeGuideSchema } from "./lib-size-guide/schema";
import { storeVisitSchema } from "./lib-store-visit/schema";
import { testimonialsSchema } from "./lib-testimonials/schema";
import { trustStripSchema } from "./lib-trust-strip/schema";
import { ugcCarouselSchema } from "./lib-ugc-carousel/schema";
import { videoSchema } from "./lib-video/schema";
import type { LibrarySectionSchema } from "./types";

export type { LibrarySectionSchema, LibrarySettingDivider } from "./types";

export const sectionLibraryCatalog: Record<string, LibrarySectionSchema> = {
  [beforeAfterSchema.type]: beforeAfterSchema,
  [bundleBuilderSchema.type]: bundleBuilderSchema,
  [collectionTilesSchema.type]: collectionTilesSchema,
  [countdownSchema.type]: countdownSchema,
  [faqSchema.type]: faqSchema,
  [gallerySchema.type]: gallerySchema,
  [heroSchema.type]: heroSchema,
  [imageTextSchema.type]: imageTextSchema,
  [logoListSchema.type]: logoListSchema,
  [lookbookSchema.type]: lookbookSchema,
  [madeToOrderSchema.type]: madeToOrderSchema,
  [marqueeSchema.type]: marqueeSchema,
  [materialsCareSchema.type]: materialsCareSchema,
  [newsletterSchema.type]: newsletterSchema,
  [processSchema.type]: processSchema,
  [productRailSchema.type]: productRailSchema,
  [promoBannerSchema.type]: promoBannerSchema,
  [richTextSchema.type]: richTextSchema,
  [shopTheLookSchema.type]: shopTheLookSchema,
  [sizeGuideSchema.type]: sizeGuideSchema,
  [storeVisitSchema.type]: storeVisitSchema,
  [testimonialsSchema.type]: testimonialsSchema,
  [trustStripSchema.type]: trustStripSchema,
  [ugcCarouselSchema.type]: ugcCarouselSchema,
  [videoSchema.type]: videoSchema,
};
