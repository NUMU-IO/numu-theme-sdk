import type { LibrarySectionSchema } from "../types";

const review = (n: number): LibrarySectionSchema["settings"] => [
  { type: "header", content: `Review ${n}`, locales: { ar: { content: `رأي ${n}` } } },
  { id: `review_${n}_name`, type: "text", label: "Name", locales: { ar: { label: "الاسم" } }, default: "" },
  { id: `review_${n}_city`, type: "text", label: "City", locales: { ar: { label: "المدينة" } }, default: "" },
  { id: `review_${n}_text`, type: "textarea", label: "Review", locales: { ar: { label: "الرأي" } }, default: "" },
  {
    id: `review_${n}_rating`,
    type: "range",
    label: "Stars",
    info: "Shown in the Cards style. 0 hides the stars.",
    locales: { ar: { label: "النجوم", info: "بتظهر في شكل الكروت. صفر يخفي النجوم." } },
    default: 5,
    min: 0,
    max: 5,
    step: 1,
  },
];

export const testimonialsSchema: LibrarySectionSchema = {
  type: "lib-testimonials",
  name: "Testimonials",
  name_ar: "آراء العملاء",
  locales: { en: { name: "Testimonials" }, ar: { name: "آراء العملاء" } },
  settings: [
    {
      id: "style",
      type: "select",
      label: "Style",
      locales: { ar: { label: "الشكل" } },
      default: "quotes",
      options: [
        { value: "quotes", label: "Pull quotes — big, magazine-style", label_ar: "اقتباسات كبيرة زي المجلات" },
        { value: "cards", label: "Cards — stars, review and name", label_ar: "كروت فيها نجوم ورأي واسم" },
      ],
    },
    { type: "header", content: "Content", locales: { ar: { content: "المحتوى" } } },
    { id: "title", type: "text", label: "Heading", locales: { ar: { label: "العنوان" } }, default: "" },
    ...review(1),
    ...review(2),
    ...review(3),
  ],
  presets: [
    {
      name: "Testimonials",
      category: "marketing",
      locales: { en: { name: "Testimonials" }, ar: { name: "آراء العملاء" } },
      settings: {},
    },
  ],
};
