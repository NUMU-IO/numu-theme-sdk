import type { LibrarySectionSchema } from "../types";

export const madeToOrderSchema: LibrarySectionSchema = {
  type: "lib-made-to-order",
  name: "Made to order",
  name_ar: "تفصيل حسب الطلب",
  locales: { en: { name: "Made to order" }, ar: { name: "تفصيل حسب الطلب" } },
  settings: [
    {
      type: "paragraph",
      content: "For pieces made after the order: say how long it takes, what can be personalised, and let customers ask you on WhatsApp.",
      locales: { ar: { content: "للقطع اللي بتتعمل بعد الطلب: قول بتاخد قد إيه، وإيه اللي ينفع يتخصّص، وخلّي العميل يسألك على واتساب." } },
    },
    { id: "title", type: "text", label: "Title", locales: { ar: { label: "العنوان" } }, default: "" },
    {
      id: "lead_time_text",
      type: "textarea",
      label: "Lead time",
      info: "How long a piece takes before it ships.",
      locales: { ar: { label: "مدة التجهيز", info: "القطعة بتاخد قد إيه لحد ما تتشحن." } },
      default: "",
    },
    {
      id: "personalization_text",
      type: "textarea",
      label: "Personalisation",
      info: "What customers can change: a name, size, colour…",
      locales: { ar: { label: "التخصيص", info: "العميل يقدر يغيّر إيه: اسم، مقاس، لون…" } },
      default: "",
    },
    { id: "note", type: "textarea", label: "Note", locales: { ar: { label: "ملاحظة" } }, default: "" },
    { type: "header", content: "WhatsApp", locales: { ar: { content: "واتساب" } } },
    {
      id: "whatsapp_number",
      type: "text",
      label: "WhatsApp number",
      info: "For example 01012345678. The button shows only when the number is valid.",
      locales: { ar: { label: "رقم الواتساب", info: "مثلًا 01012345678. الزرار بيظهر بس لما الرقم يكون صح." } },
      default: "",
    },
    { id: "button_label", type: "text", label: "Button text", locales: { ar: { label: "كلام الزرار" } }, default: "" },
  ],
  presets: [
    {
      name: "Made to order",
      category: "content",
      locales: { en: { name: "Made to order" }, ar: { name: "تفصيل حسب الطلب" } },
      settings: {},
    },
  ],
};
