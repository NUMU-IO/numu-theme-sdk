import type { LibrarySectionSchema } from "../types";

const step = (n: number): LibrarySectionSchema["settings"] => [
  { type: "header", content: `Step ${n}`, locales: { ar: { content: `الخطوة ${n}` } } },
  { id: `step_${n}_title`, type: "text", label: "Title", locales: { ar: { label: "العنوان" } }, default: "" },
  { id: `step_${n}_text`, type: "textarea", label: "Description", locales: { ar: { label: "الوصف" } }, default: "" },
  {
    id: `step_${n}_image`,
    type: "image_picker",
    label: "Photo (optional)",
    locales: { ar: { label: "صورة (اختياري)" } },
    aspect_ratio: "7/5",
    default: "",
  },
];

/** Setting ids match Skeuomorphic's `skeu-process` one-for-one. */
export const processSchema: LibrarySectionSchema = {
  type: "lib-process",
  name: "Process steps",
  name_ar: "خطوات الشغل",
  locales: { en: { name: "Process steps" }, ar: { name: "خطوات الشغل" } },
  settings: [
    {
      type: "paragraph",
      content: "Up to five numbered steps. A step shows once it has a title or a description.",
      locales: { ar: { content: "لحد خمس خطوات مترقّمة. الخطوة بتظهر أول ما يكون ليها عنوان أو وصف." } },
    },
    { type: "header", content: "Content", locales: { ar: { content: "المحتوى" } } },
    { id: "title", type: "text", label: "Heading", locales: { ar: { label: "عنوان القسم" } }, default: "" },
    { id: "intro", type: "textarea", label: "Intro", locales: { ar: { label: "مقدمة" } }, default: "" },
    ...step(1),
    ...step(2),
    ...step(3),
    ...step(4),
    ...step(5),
  ],
  presets: [
    {
      name: "Process steps",
      category: "content",
      locales: { en: { name: "Process steps" }, ar: { name: "خطوات الشغل" } },
      settings: {},
    },
  ],
};
