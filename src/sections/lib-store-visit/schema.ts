import type { LibrarySectionSchema } from "../types";

/** Setting ids match Genova's `gn-store-visit` one-for-one. */
export const storeVisitSchema: LibrarySectionSchema = {
  type: "lib-store-visit",
  name: "Visit our shop",
  name_ar: "زورنا في المحل",
  locales: { en: { name: "Visit our shop" }, ar: { name: "زورنا في المحل" } },
  settings: [
    {
      type: "paragraph",
      content: "A shop customers can walk into is the strongest trust signal you have. Give it a real photo and a real address.",
      locales: { ar: { content: "المحل اللي الزباين يقدروا ييجوا له هو أقوى دليل ثقة عندك. حط له صورة حقيقية وعنوان حقيقي." } },
    },
    { id: "heading", type: "text", label: "Heading", locales: { ar: { label: "عنوان القسم" } }, default: "" },
    {
      id: "image",
      type: "image_picker",
      label: "Photo of the shop",
      locales: { ar: { label: "صورة المحل" } },
      aspect_ratio: "4/3",
      default: "",
    },
    {
      id: "address",
      type: "textarea",
      label: "Address (English)",
      info: "The section shows once an address is filled in.",
      locales: { ar: { label: "عنوان المحل (إنجليزي)", info: "القسم بيظهر أول ما تكتب العنوان." } },
      default: "",
    },
    { id: "address_ar", type: "textarea", label: "Address (Arabic)", locales: { ar: { label: "عنوان المحل (عربي)" } }, default: "" },
    { id: "hours", type: "text", label: "Opening hours", locales: { ar: { label: "مواعيد الشغل" } }, default: "" },
    { id: "phone", type: "text", label: "Phone", locales: { ar: { label: "رقم التليفون" } }, default: "" },
    {
      id: "whatsapp",
      type: "text",
      label: "WhatsApp number",
      info: "Egyptian numbers work as typed. For other countries, include the country code.",
      locales: { ar: { label: "رقم واتساب", info: "الرقم المصري اكتبه عادي. لو الرقم من بلد تانية، اكتبه بكود الدولة." } },
      default: "",
    },
    {
      id: "show_directions_button",
      type: "checkbox",
      label: "Show the directions button",
      locales: { ar: { label: "اظهر زرار الخريطة" } },
      default: true,
    },
    { id: "map_link", type: "url", label: "Google Maps link", locales: { ar: { label: "لينك جوجل ماب" } }, default: "" },
  ],
  presets: [
    {
      name: "Visit our shop",
      category: "content",
      locales: { en: { name: "Visit our shop" }, ar: { name: "زورنا في المحل" } },
      settings: {},
    },
  ],
};
