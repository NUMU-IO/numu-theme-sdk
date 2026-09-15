import type { LibrarySectionSchema } from "../types";

export const imageTextSchema: LibrarySectionSchema = {
  type: "lib-image-text",
  name: "Image with text",
  name_ar: "صورة وكلام",
  locales: { en: { name: "Image with text" }, ar: { name: "صورة وكلام" } },
  settings: [
    {
      id: "style",
      type: "select",
      label: "Style",
      locales: { ar: { label: "الشكل" } },
      default: "split",
      options: [
        { value: "split", label: "Split — image beside the text", label_ar: "الصورة جنب الكلام" },
        { value: "overlay", label: "Overlay — text on the image", label_ar: "الكلام فوق الصورة" },
        { value: "story", label: "Story — quote and value cards", label_ar: "حكاية البراند: اقتباس وكروت" },
      ],
    },
    { type: "header", content: "Image", locales: { ar: { content: "الصورة" } } },
    { id: "image", type: "image_picker", label: "Image", locales: { ar: { label: "الصورة" } }, default: "" },
    {
      id: "image_position",
      type: "select",
      label: "Image side",
      info: "Split style only. On phones the image always sits above the text.",
      locales: { ar: { label: "مكان الصورة", info: "للشكل اللي الصورة جنب الكلام بس. على الموبايل الصورة دايمًا فوق الكلام." } },
      default: "start",
      options: [
        { value: "start", label: "Start side", label_ar: "ناحية البداية" },
        { value: "end", label: "End side", label_ar: "ناحية النهاية" },
      ],
    },
    {
      id: "overlay_opacity",
      type: "range",
      label: "Image darkening",
      info: "Overlay style only.",
      locales: { ar: { label: "تغميق الصورة", info: "للشكل اللي الكلام فوق الصورة بس." } },
      default: 35,
      min: 0,
      max: 70,
      step: 5,
      unit: "%",
    },
    { type: "header", content: "Text", locales: { ar: { content: "الكلام" } } },
    { id: "eyebrow", type: "text", label: "Small line above the title", locales: { ar: { label: "سطر صغير فوق العنوان" } }, default: "" },
    { id: "title", type: "text", label: "Title", locales: { ar: { label: "العنوان" } }, default: "" },
    { id: "quote", type: "textarea", label: "Quote", locales: { ar: { label: "اقتباس" } }, default: "" },
    { id: "body", type: "textarea", label: "Text", locales: { ar: { label: "الكلام" } }, default: "" },
    { id: "cta_text", type: "text", label: "Button text", locales: { ar: { label: "كلام الزرار" } }, default: "" },
    { id: "cta_link", type: "url", label: "Button link", locales: { ar: { label: "لينك الزرار" } }, default: "/products" },
  ],
  blocks: [
    {
      type: "value",
      name: "Value card",
      name_ar: "كارت",
      locales: { en: { name: "Value card" }, ar: { name: "كارت" } },
      settings: [
        { id: "title", type: "text", label: "Title", locales: { ar: { label: "العنوان" } }, default: "" },
        { id: "text", type: "textarea", label: "Text", locales: { ar: { label: "الكلام" } }, default: "" },
      ],
    },
  ],
  max_blocks: 4,
  presets: [
    {
      name: "Image with text",
      category: "content",
      locales: { en: { name: "Image with text" }, ar: { name: "صورة وكلام" } },
      settings: {},
    },
  ],
};
