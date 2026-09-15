import type { LibrarySectionSchema } from "../types";

export const trustStripSchema: LibrarySectionSchema = {
  type: "lib-trust-strip",
  name: "Why shop with us",
  name_ar: "ليه تشتري مننا",
  locales: { en: { name: "Why shop with us" }, ar: { name: "ليه تشتري مننا" } },
  settings: [
    {
      type: "paragraph",
      content: "Short reassurance points like cash on delivery, fast shipping and easy exchange. Keep each one to a few words.",
      locales: { ar: { content: "نقط قصيرة بتطمّن العميل، زي الدفع عند الاستلام والشحن السريع والاستبدال السهل. خلّي كل نقطة كلمتين تلاتة." } },
    },
    {
      id: "style",
      type: "select",
      label: "Style",
      locales: { ar: { label: "الشكل" } },
      default: "row",
      options: [
        { value: "row", label: "Row with dividers", label_ar: "صف بفواصل" },
        { value: "cards", label: "Cards", label_ar: "كروت" },
      ],
    },
    {
      id: "heading",
      type: "text",
      label: "Heading (optional)",
      info: "Shown small above the points.",
      locales: { ar: { label: "العنوان (اختياري)", info: "بيظهر صغير فوق النقط." } },
      default: "",
    },
  ],
  blocks: [
    {
      type: "item",
      name: "Point",
      name_ar: "نقطة",
      locales: { en: { name: "Point" }, ar: { name: "نقطة" } },
      settings: [
        {
          id: "icon",
          type: "select",
          label: "Icon",
          locales: { ar: { label: "الأيقونة" } },
          default: "shield",
          options: [
            { value: "truck", label: "Delivery truck", label_ar: "عربية شحن" },
            { value: "cash", label: "Cash", label_ar: "فلوس كاش" },
            { value: "return", label: "Exchange", label_ar: "استبدال" },
            { value: "shield", label: "Guarantee", label_ar: "ضمان" },
            { value: "star", label: "Star", label_ar: "نجمة" },
            { value: "chat", label: "Chat", label_ar: "محادثة" },
            { value: "gift", label: "Gift", label_ar: "هدية" },
            { value: "clock", label: "Clock", label_ar: "ساعة" },
          ],
        },
        { id: "title", type: "text", label: "Title", locales: { ar: { label: "العنوان" } }, default: "" },
        { id: "text", type: "text", label: "Text", locales: { ar: { label: "الكلام" } }, default: "" },
      ],
    },
  ],
  max_blocks: 6,
  presets: [
    {
      name: "Why shop with us",
      category: "marketing",
      locales: { en: { name: "Why shop with us" }, ar: { name: "ليه تشتري مننا" } },
      settings: {},
    },
  ],
};
