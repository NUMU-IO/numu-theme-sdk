import type { LibrarySectionSchema } from "../types";

export const productReviewsSchema: LibrarySectionSchema = {
  type: "lib-product-reviews",
  name: "Product reviews",
  name_ar: "تقييمات المنتج",
  locales: { en: { name: "Product reviews" }, ar: { name: "تقييمات المنتج" } },
  // One list per product page.
  limit: 1,
  settings: [
    {
      id: "title",
      type: "text",
      label: "Heading",
      info: "Shows the reviews collected by the Reviews app. Without the app it shows nothing.",
      locales: {
        ar: {
          label: "العنوان",
          info: "بيعرض التقييمات اللي جمعها تطبيق آراء العملاء. من غير التطبيق مش بيظهر حاجة.",
        },
      },
      default: "",
    },
  ],
  presets: [
    {
      name: "Product reviews",
      category: "product",
      locales: { en: { name: "Product reviews" }, ar: { name: "تقييمات المنتج" } },
      settings: {},
    },
  ],
};
