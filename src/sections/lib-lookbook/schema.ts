import type { LibrarySectionSchema } from "../types";

const look = (n: number): LibrarySectionSchema["settings"] => [
  { type: "header", content: `Look ${n}`, locales: { ar: { content: `لوك ${n}` } } },
  {
    id: `look_${n}_image`,
    type: "image_picker",
    label: "Image",
    info: "A look shows only when it has an image.",
    locales: { ar: { label: "الصورة", info: "اللوك مش هيظهر غير لما يكون له صورة." } },
    aspect_ratio: "3/4",
    default: "",
  },
  { id: `look_${n}_caption`, type: "textarea", label: "Caption", locales: { ar: { label: "الكلام تحت الصورة" } }, default: "" },
  { id: `look_${n}_link`, type: "url", label: "Link", locales: { ar: { label: "اللينك" } }, default: "" },
  {
    id: `look_${n}_link_label`,
    type: "text",
    label: "Link text",
    info: "Leave empty to show “Shop the look”.",
    locales: { ar: { label: "كلام اللينك", info: "لو سبته فاضي هيظهر «اتسوّق اللوك»." } },
    default: "",
  },
];

/** Setting ids match Editorial's `ed-lookbook` one-for-one. */
export const lookbookSchema: LibrarySectionSchema = {
  type: "lib-lookbook",
  name: "Lookbook (editorial spread)",
  name_ar: "لوك بوك (زي المجلات)",
  locales: { en: { name: "Lookbook (editorial spread)" }, ar: { name: "لوك بوك (زي المجلات)" } },
  settings: [
    { type: "header", content: "Content", locales: { ar: { content: "المحتوى" } } },
    { id: "title", type: "text", label: "Heading", locales: { ar: { label: "عنوان القسم" } }, default: "" },
    { id: "intro", type: "textarea", label: "Intro text", locales: { ar: { label: "مقدمة" } }, default: "" },
    ...look(1),
    ...look(2),
    ...look(3),
    ...look(4),
    ...look(5),
    ...look(6),
  ],
  presets: [
    {
      name: "Lookbook",
      category: "content",
      locales: { en: { name: "Lookbook" }, ar: { name: "لوك بوك" } },
      settings: {},
    },
  ],
};
