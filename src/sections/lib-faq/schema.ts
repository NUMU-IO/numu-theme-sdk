import type { LibrarySectionSchema } from "../types";

export const faqSchema: LibrarySectionSchema = {
  type: "lib-faq",
  name: "FAQ",
  name_ar: "الأسئلة الشائعة",
  locales: { en: { name: "FAQ" }, ar: { name: "الأسئلة الشائعة" } },
  // One FAQPage per page: a second FAQ section would duplicate the microdata.
  limit: 1,
  settings: [
    { id: "heading", type: "text", label: "Heading", locales: { ar: { label: "العنوان" } }, default: "" },
    {
      id: "show_group_headings",
      type: "checkbox",
      label: "Show group headings",
      locales: { ar: { label: "اظهر عناوين المجموعات" } },
      default: true,
    },
    {
      id: "contact_text",
      type: "text",
      label: "Closing line",
      info: "Shown under the questions, followed by a contact link.",
      locales: { ar: { label: "سطر في الآخر", info: "بيظهر تحت الأسئلة وجنبه لينك للتواصل." } },
      default: "",
    },
    { id: "contact_link", type: "url", label: "Contact link", locales: { ar: { label: "لينك التواصل" } }, default: "/contact" },
  ],
  blocks: [
    {
      type: "group",
      name: "Group",
      name_ar: "مجموعة",
      locales: { en: { name: "Group" }, ar: { name: "مجموعة" } },
      settings: [{ id: "title", type: "text", label: "Group heading", locales: { ar: { label: "عنوان المجموعة" } }, default: "" }],
      blocks: [
        {
          type: "qa",
          name: "Question",
          name_ar: "سؤال",
          locales: { en: { name: "Question" }, ar: { name: "سؤال" } },
          settings: [
            { id: "question", type: "text", label: "Question", locales: { ar: { label: "السؤال" } }, default: "" },
            { id: "answer", type: "textarea", label: "Answer", locales: { ar: { label: "الإجابة" } }, default: "" },
          ],
        },
      ],
    },
  ],
  max_blocks: 8,
  presets: [
    {
      name: "FAQ",
      category: "content",
      locales: { en: { name: "FAQ" }, ar: { name: "الأسئلة الشائعة" } },
      settings: {},
    },
  ],
};
