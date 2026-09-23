import type { LibrarySectionSchema } from "../types";

export const reviewImagesSchema: LibrarySectionSchema = {
  type: "lib-review-images",
  name: "Review screenshots",
  name_ar: "صور آراء العملاء",
  locales: { en: { name: "Review screenshots" }, ar: { name: "صور آراء العملاء" } },
  settings: [
    { type: "header", content: "Heading", locales: { ar: { content: "العنوان" } } },
    {
      id: "heading",
      type: "text",
      label: "Heading",
      info: "Leave empty to show “What our customers say”.",
      locales: { ar: { label: "العنوان", info: "لو سبته فاضي هيظهر «آراء عملائنا»." } },
      default: "",
    },
    { id: "subtitle", type: "text", label: "Subtitle", locales: { ar: { label: "عنوان فرعي" } }, default: "" },
    { type: "header", content: "Motion", locales: { ar: { content: "الحركة" } } },
    {
      id: "direction",
      type: "select",
      label: "Direction",
      locales: { ar: { label: "الاتجاه" } },
      default: "left",
      options: [
        { value: "left", label: "To the left", label_ar: "ناحية الشمال" },
        { value: "right", label: "To the right", label_ar: "ناحية اليمين" },
      ],
    },
    {
      id: "speed",
      type: "select",
      label: "Speed",
      info: "The strip stops while the mouse is over it, so shoppers can read.",
      locales: { ar: { label: "السرعة", info: "الشريط بيقف لما الماوس يعدّي عليه، علشان العميل يعرف يقرا." } },
      default: "normal",
      options: [
        { value: "slow", label: "Slow", label_ar: "بطيء" },
        { value: "normal", label: "Normal", label_ar: "عادي" },
        { value: "fast", label: "Fast", label_ar: "سريع" },
      ],
    },
    { type: "header", content: "Look", locales: { ar: { content: "الشكل" } } },
    {
      id: "image_height",
      type: "range",
      label: "Image height",
      info: "Phones show the images a little smaller.",
      locales: { ar: { label: "طول الصورة", info: "على الموبايل الصور بتظهر أصغر شوية." } },
      default: 360,
      min: 160,
      max: 560,
      step: 20,
      unit: "px",
    },
  ],
  blocks: [
    {
      type: "review",
      name: "Review screenshot",
      name_ar: "صورة رأي",
      locales: { en: { name: "Review screenshot" }, ar: { name: "صورة رأي" } },
      settings: [
        {
          id: "image",
          type: "image_picker",
          label: "Screenshot",
          info: "A chat, comment or message from a customer.",
          locales: { ar: { label: "الصورة", info: "سكرين من شات أو كومنت أو رسالة من عميل." } },
          default: "",
        },
      ],
    },
  ],
  max_blocks: 24,
  presets: [
    {
      name: "Review screenshots",
      category: "marketing",
      locales: { en: { name: "Review screenshots" }, ar: { name: "صور آراء العملاء" } },
      settings: {},
    },
  ],
};
