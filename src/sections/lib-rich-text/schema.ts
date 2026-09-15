import type { LibrarySectionSchema } from "../types";

export const richTextSchema: LibrarySectionSchema = {
  type: "lib-rich-text",
  name: "Text block",
  name_ar: "فقرة كلام",
  locales: { en: { name: "Text block" }, ar: { name: "فقرة كلام" } },
  settings: [
    {
      id: "style",
      type: "select",
      label: "Style",
      locales: { ar: { label: "الشكل" } },
      default: "plain",
      options: [
        { value: "plain", label: "Plain text", label_ar: "كلام عادي" },
        { value: "note", label: "Editor's note — signed letter", label_ar: "كلمة المحرر: رسالة بتوقيع" },
      ],
    },
    { id: "heading", type: "text", label: "Heading", locales: { ar: { label: "العنوان" } }, default: "" },
    { id: "content", type: "richtext", label: "Text", locales: { ar: { label: "الكلام" } }, default: "" },
    { type: "header", content: "Editor's note", locales: { ar: { content: "كلمة المحرر" } } },
    {
      id: "kicker",
      type: "text",
      label: "Small line on top",
      info: "Editor's note style only.",
      locales: { ar: { label: "سطر صغير فوق", info: "لشكل كلمة المحرر بس." } },
      default: "",
    },
    { id: "byline_name", type: "text", label: "Signed by", locales: { ar: { label: "التوقيع (الاسم)" } }, default: "" },
    { id: "byline_role", type: "text", label: "Role", locales: { ar: { label: "الوظيفة" } }, default: "" },
    { type: "header", content: "Layout", locales: { ar: { content: "الترتيب" } } },
    {
      id: "width",
      type: "select",
      label: "Width",
      locales: { ar: { label: "العرض" } },
      default: "narrow",
      options: [
        { value: "narrow", label: "Narrow (easier to read)", label_ar: "ضيق (أريح في القراية)" },
        { value: "wide", label: "Wide", label_ar: "عريض" },
      ],
    },
    {
      id: "align",
      type: "select",
      label: "Alignment",
      locales: { ar: { label: "المحاذاة" } },
      default: "start",
      options: [
        { value: "start", label: "Start side", label_ar: "ناحية البداية" },
        { value: "center", label: "Centre", label_ar: "في النص" },
      ],
    },
  ],
  presets: [
    {
      name: "Text block",
      category: "content",
      locales: { en: { name: "Text block" }, ar: { name: "فقرة كلام" } },
      settings: {},
    },
  ],
};
