import type { LibrarySectionSchema } from "../types";

export const logoListSchema: LibrarySectionSchema = {
  type: "lib-logo-list",
  name: "Logos",
  name_ar: "لوجوهات",
  locales: { en: { name: "Logos" }, ar: { name: "لوجوهات" } },
  settings: [
    {
      type: "paragraph",
      content: "Brands you carry, press that wrote about you, or partners. Upload logos with a transparent background for the cleanest look.",
      locales: { ar: { content: "البراندات اللي بتبيعها، أو الصحافة اللي كتبت عنك، أو شركاءك. ارفع اللوجوهات بخلفية شفافة علشان تبان أنضف." } },
    },
    { id: "heading", type: "text", label: "Heading", locales: { ar: { label: "العنوان" } }, default: "" },
    {
      id: "style",
      type: "select",
      label: "Style",
      locales: { ar: { label: "الشكل" } },
      default: "row",
      options: [
        { value: "row", label: "Centred row", label_ar: "صف في النص" },
        { value: "grid", label: "Grid with borders", label_ar: "شبكة بخطوط" },
      ],
    },
    {
      id: "grayscale",
      type: "checkbox",
      label: "Grey logos, colour on hover",
      locales: { ar: { label: "لوجوهات رمادي، وتتلوّن لما الماوس يعدّي عليها" } },
      default: true,
    },
    {
      id: "logo_height",
      type: "range",
      label: "Logo height",
      locales: { ar: { label: "طول اللوجو" } },
      default: 40,
      min: 24,
      max: 96,
      step: 4,
      unit: "px",
    },
  ],
  blocks: [
    {
      type: "logo",
      name: "Logo",
      name_ar: "لوجو",
      locales: { en: { name: "Logo" }, ar: { name: "لوجو" } },
      settings: [
        { id: "image", type: "image_picker", label: "Logo image", locales: { ar: { label: "صورة اللوجو" } }, default: "" },
        {
          id: "name",
          type: "text",
          label: "Name",
          info: "Read aloud by screen readers.",
          locales: { ar: { label: "الاسم", info: "بيتقري بصوت عالي لمستخدمي قارئ الشاشة." } },
          default: "",
        },
        { id: "link", type: "url", label: "Link (optional)", locales: { ar: { label: "لينك (اختياري)" } }, default: "" },
      ],
    },
  ],
  max_blocks: 16,
  presets: [
    {
      name: "Logos",
      category: "marketing",
      locales: { en: { name: "Logos" }, ar: { name: "لوجوهات" } },
      settings: {},
    },
  ],
};
