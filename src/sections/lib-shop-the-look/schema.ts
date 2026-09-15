import type { LibrarySectionSchema } from "../types";

export const shopTheLookSchema: LibrarySectionSchema = {
  type: "lib-shop-the-look",
  name: "Shop the look",
  name_ar: "اتسوّق اللوك",
  locales: { en: { name: "Shop the look" }, ar: { name: "اتسوّق اللوك" } },
  settings: [
    { id: "heading", type: "text", label: "Heading", locales: { ar: { label: "العنوان" } }, default: "" },
    { id: "image", type: "image_picker", label: "Image (desktop)", locales: { ar: { label: "الصورة (كمبيوتر)" } }, default: "" },
    {
      id: "image_mobile",
      type: "image_picker",
      label: "Image (mobile)",
      info: "Optional. Keep the same framing, or the hotspots will land in the wrong place.",
      locales: { ar: { label: "الصورة (موبايل)", info: "اختياري. خلّي الكادر زي صورة الكمبيوتر، وإلا النقط هتيجي في مكان غلط." } },
      default: "",
    },
    {
      id: "layout",
      type: "select",
      label: "Photo position",
      info: "On phones the list always sits under the photo.",
      locales: { ar: { label: "مكان الصورة", info: "على الموبايل القايمة دايمًا بتبقى تحت الصورة." } },
      default: "image-start",
      options: [
        { value: "image-start", label: "Photo first, list beside it", label_ar: "الصورة الأول والقايمة جنبها" },
        { value: "image-end", label: "List first, photo beside it", label_ar: "القايمة الأول والصورة جنبها" },
      ],
    },
  ],
  blocks: [
    {
      type: "hotspot",
      name: "Hotspot",
      name_ar: "نقطة",
      locales: { en: { name: "Hotspot" }, ar: { name: "نقطة" } },
      settings: [
        {
          id: "x",
          type: "range",
          label: "Across (from the left edge of the photo)",
          locales: { ar: { label: "بالعرض (من شمال الصورة)" } },
          default: 50,
          min: 0,
          max: 100,
          step: 1,
          unit: "%",
        },
        { id: "y", type: "range", label: "Down (from the top)", locales: { ar: { label: "بالطول (من فوق)" } }, default: 50, min: 0, max: 100, step: 1, unit: "%" },
        { id: "label", type: "text", label: "Product name", locales: { ar: { label: "اسم المنتج" } }, default: "" },
        {
          id: "price_text",
          type: "text",
          label: "Price",
          info: "Typed as you want it shown, e.g. EGP 450.",
          locales: { ar: { label: "السعر", info: "اكتبه زي ما عايزه يظهر، زي ‎EGP 450." } },
          default: "",
        },
        { id: "link", type: "url", label: "Link", locales: { ar: { label: "اللينك" } }, default: "" },
      ],
    },
  ],
  max_blocks: 8,
  presets: [
    {
      name: "Shop the look",
      category: "products",
      locales: { en: { name: "Shop the look" }, ar: { name: "اتسوّق اللوك" } },
      settings: {},
    },
  ],
};
