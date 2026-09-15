import type { LibrarySectionSchema } from "../types";

export const countdownSchema: LibrarySectionSchema = {
  type: "lib-countdown",
  name: "Offer countdown",
  name_ar: "عداد العرض",
  locales: { en: { name: "Offer countdown" }, ar: { name: "عداد العرض" } },
  settings: [
    { type: "header", content: "Offer", locales: { ar: { content: "العرض" } } },
    {
      id: "ends_at",
      type: "text",
      label: "Offer ends at",
      info: "Date and time in Cairo time, written like 2026-10-01T23:59.",
      locales: { ar: { label: "العرض بيخلص إمتى", info: "التاريخ والساعة بتوقيت القاهرة، اكتبهم بالشكل ده: 2026-10-01T23:59" } },
      default: "",
    },
    { id: "heading", type: "text", label: "Heading", locales: { ar: { label: "العنوان" } }, default: "" },
    { id: "text", type: "textarea", label: "Text", locales: { ar: { label: "الكلام" } }, default: "" },
    { id: "cta_text", type: "text", label: "Button text", locales: { ar: { label: "كلام الزرار" } }, default: "" },
    { id: "cta_link", type: "url", label: "Button link", locales: { ar: { label: "لينك الزرار" } }, default: "/products" },
    { type: "header", content: "Look", locales: { ar: { content: "الشكل" } } },
    {
      id: "style",
      type: "select",
      label: "Style",
      locales: { ar: { label: "الشكل" } },
      default: "band",
      options: [
        { value: "band", label: "Full-width band", label_ar: "شريط بعرض الشاشة" },
        { value: "card", label: "Centred card", label_ar: "كارت في النص" },
      ],
    },
    { type: "header", content: "When the offer ends", locales: { ar: { content: "لما العرض يخلص" } } },
    {
      id: "after_end",
      type: "select",
      label: "After the end",
      locales: { ar: { label: "بعد ما يخلص" } },
      default: "hide",
      options: [
        { value: "hide", label: "Hide the section", label_ar: "اخفي القسم" },
        { value: "message", label: "Show a message", label_ar: "اعرض رسالة" },
      ],
    },
    {
      id: "ended_text",
      type: "text",
      label: "Message after the end",
      info: "Leave empty for \"This offer has ended\".",
      locales: { ar: { label: "الرسالة بعد ما يخلص", info: "سيبها فاضية علشان يظهر «العرض خلص»." } },
      default: "",
    },
  ],
  presets: [
    {
      name: "Offer countdown",
      category: "marketing",
      locales: { en: { name: "Offer countdown" }, ar: { name: "عداد العرض" } },
      settings: { style: "band", after_end: "hide", cta_link: "/products" },
    },
  ],
};
