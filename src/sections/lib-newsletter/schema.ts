import type { LibrarySectionSchema } from "../types";

export const newsletterSchema: LibrarySectionSchema = {
  type: "lib-newsletter",
  name: "Newsletter signup",
  name_ar: "اشتراك بالإيميل",
  locales: { en: { name: "Newsletter signup" }, ar: { name: "اشتراك بالإيميل" } },
  settings: [
    {
      id: "style",
      type: "select",
      label: "Style",
      locales: { ar: { label: "الشكل" } },
      default: "centered",
      options: [
        { value: "centered", label: "Centred — heading over the form", label_ar: "في النص: عنوان وتحته الفورم" },
        { value: "card", label: "Card — a tinted panel", label_ar: "كارت ملوّن" },
        { value: "split", label: "Split — an image beside the form", label_ar: "صورة وجنبها الفورم" },
      ],
    },
    {
      type: "paragraph",
      content: "Subscribers are saved to Customers with the \"newsletter\" tag and marketing consent, so you can export them or send them offers.",
      locales: { ar: { content: "المشتركين بيتسجلوا في صفحة العملاء بتاج «newsletter» وموافقين يوصلهم تسويق، فتقدر تصدّرهم أو تبعتلهم عروض." } },
    },
    {
      id: "heading",
      type: "text",
      label: "Heading",
      info: "Leave empty to hide.",
      locales: { ar: { label: "العنوان", info: "سيبه فاضي علشان يختفي." } },
    },
    {
      id: "text",
      type: "textarea",
      label: "Text",
      info: "Leave empty to hide.",
      locales: { ar: { label: "الكلام تحت العنوان", info: "سيبه فاضي علشان يختفي." } },
    },
    { id: "placeholder", type: "text", label: "Email field hint", locales: { ar: { label: "الكلام جوه خانة الإيميل" } } },
    { id: "button_text", type: "text", label: "Button text", locales: { ar: { label: "كلام الزرار" } } },
    {
      id: "success_text",
      type: "text",
      label: "Thank-you message",
      locales: { ar: { label: "رسالة الشكر بعد الاشتراك" } },
    },
    {
      id: "note",
      type: "text",
      label: "Small print under the form",
      info: "e.g. \"No spam. Unsubscribe any time.\"",
      locales: { ar: { label: "سطر صغير تحت الفورم", info: "مثلًا «مش هنزعجك، وتقدر تلغي في أي وقت»." } },
      default: "",
    },
    { type: "header", content: "Split style", locales: { ar: { content: "شكل الصورة والفورم" } } },
    { id: "image", type: "image_picker", label: "Image", locales: { ar: { label: "الصورة" } }, default: "" },
  ],
  presets: [
    {
      name: "Newsletter signup",
      category: "marketing",
      locales: { en: { name: "Newsletter signup" }, ar: { name: "اشتراك بالإيميل" } },
      settings: {},
    },
  ],
};
