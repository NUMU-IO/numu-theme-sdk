import type { LibrarySectionSchema } from "../types";

export const sizeGuideSchema: LibrarySectionSchema = {
  type: "lib-size-guide",
  name: "Size guide",
  name_ar: "دليل المقاسات",
  locales: { en: { name: "Size guide" }, ar: { name: "دليل المقاسات" } },
  settings: [
    {
      id: "style",
      type: "select",
      label: "Style",
      locales: { ar: { label: "الشكل" } },
      default: "table",
      options: [
        { value: "table", label: "Chart first, then measuring tips", label_ar: "الجدول الأول وبعده نصايح القياس" },
        { value: "fits", label: "Fit cards first, then the chart", label_ar: "كروت القصّات الأول وبعدها الجدول" },
      ],
    },
    { id: "heading", type: "text", label: "Heading", locales: { ar: { label: "العنوان" } }, default: "" },
    { id: "intro", type: "textarea", label: "Intro", locales: { ar: { label: "مقدمة" } }, default: "" },
    { type: "header", content: "Chart", locales: { ar: { content: "جدول المقاسات" } } },
    {
      id: "unit",
      type: "select",
      label: "Unit",
      locales: { ar: { label: "وحدة القياس" } },
      default: "cm",
      options: [
        { value: "cm", label: "Centimetres", label_ar: "سنتيمتر" },
        { value: "in", label: "Inches", label_ar: "بوصة" },
      ],
    },
    {
      id: "chart_columns",
      type: "text",
      label: "Columns after the size",
      info: "Separate with commas, e.g. Waist, Hip, Length. Each row's values follow the same order.",
      locales: {
        ar: {
          label: "الأعمدة بعد المقاس",
          info: "افصل بينهم بفاصلة، زي: الوسط، الهيب، الطول. أرقام كل صف بتمشي بنفس الترتيب.",
        },
      },
      default: "",
    },
    {
      id: "model_note",
      type: "text",
      label: "Note under the chart",
      info: "e.g. The model is 175 cm and wears M.",
      locales: { ar: { label: "ملحوظة تحت الجدول", info: "زي: الموديل طوله 175 سم ولابس M." } },
      default: "",
    },
    { type: "header", content: "Measuring tips", locales: { ar: { content: "نصايح القياس" } } },
    { id: "measure_heading", type: "text", label: "Tips heading", locales: { ar: { label: "عنوان النصايح" } }, default: "" },
    { type: "header", content: "WhatsApp", locales: { ar: { content: "واتساب" } } },
    {
      id: "whatsapp_number",
      type: "text",
      label: "WhatsApp number",
      info: "The button shows only when a number is set.",
      locales: { ar: { label: "رقم الواتساب", info: "الزرار بيظهر بس لما يكون فيه رقم." } },
      default: "",
    },
    { id: "whatsapp_text", type: "text", label: "Button text", locales: { ar: { label: "كلام الزرار" } }, default: "" },
  ],
  blocks: [
    {
      type: "row",
      name: "Size row",
      name_ar: "صف مقاس",
      locales: { en: { name: "Size row" }, ar: { name: "صف مقاس" } },
      limit: 20,
      settings: [
        { id: "size", type: "text", label: "Size", locales: { ar: { label: "المقاس" } }, default: "" },
        {
          id: "values",
          type: "text",
          label: "Values",
          info: "Comma-separated, in the same order as the columns.",
          locales: { ar: { label: "الأرقام", info: "بينهم فاصلة، وبنفس ترتيب الأعمدة." } },
          default: "",
        },
      ],
    },
    {
      type: "measure",
      name: "Measuring tip",
      name_ar: "نصيحة قياس",
      locales: { en: { name: "Measuring tip" }, ar: { name: "نصيحة قياس" } },
      limit: 6,
      settings: [
        { id: "title", type: "text", label: "Title", locales: { ar: { label: "العنوان" } }, default: "" },
        { id: "text", type: "textarea", label: "Text", locales: { ar: { label: "الشرح" } }, default: "" },
      ],
    },
    {
      type: "fit",
      name: "Fit",
      name_ar: "قصّة",
      locales: { en: { name: "Fit" }, ar: { name: "قصّة" } },
      limit: 6,
      settings: [
        { id: "name", type: "text", label: "Name", locales: { ar: { label: "الاسم" } }, default: "" },
        { id: "image", type: "image_picker", label: "Image", locales: { ar: { label: "الصورة" } }, default: "" },
        { id: "best_for", type: "textarea", label: "Best for", locales: { ar: { label: "مناسبة لمين" } }, default: "" },
        { id: "link", type: "url", label: "Link", locales: { ar: { label: "اللينك" } }, default: "" },
      ],
    },
  ],
  max_blocks: 32,
  presets: [
    {
      name: "Size guide",
      category: "content",
      locales: { en: { name: "Size guide" }, ar: { name: "دليل المقاسات" } },
      settings: {},
    },
  ],
};
