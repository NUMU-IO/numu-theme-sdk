import type { LibrarySectionSchema } from "../types";

export const materialsCareSchema: LibrarySectionSchema = {
  type: "lib-materials-care",
  name: "Materials & care",
  name_ar: "الخامات والعناية",
  locales: { en: { name: "Materials & care" }, ar: { name: "الخامات والعناية" } },
  settings: [
    {
      id: "style",
      type: "select",
      label: "Style",
      locales: { ar: { label: "الشكل" } },
      default: "list",
      options: [
        { value: "list", label: "List — one row under another", label_ar: "ليستة — صف تحت التاني" },
        { value: "columns", label: "Columns — cards in two columns", label_ar: "أعمدة — كروت في عمودين" },
      ],
    },
    { id: "heading", type: "text", label: "Heading", locales: { ar: { label: "العنوان" } }, default: "" },
    {
      id: "guarantee_text",
      type: "textarea",
      label: "Guarantee note",
      info: "Shown highlighted under the rows.",
      locales: { ar: { label: "ملحوظة الضمان", info: "بتظهر مميزة تحت الصفوف." } },
      default: "",
    },
  ],
  blocks: [
    {
      type: "row",
      name: "Row",
      name_ar: "صف",
      locales: { en: { name: "Row" }, ar: { name: "صف" } },
      limit: 12,
      settings: [
        { id: "term", type: "text", label: "Title", info: "e.g. Fabric, Washing", locales: { ar: { label: "العنوان", info: "زي: الخامة، الغسيل" } }, default: "" },
        { id: "description", type: "textarea", label: "Description", locales: { ar: { label: "الوصف" } }, default: "" },
      ],
    },
  ],
  max_blocks: 12,
  presets: [
    {
      name: "Materials & care",
      category: "content",
      locales: { en: { name: "Materials & care" }, ar: { name: "الخامات والعناية" } },
      settings: {},
    },
  ],
};
