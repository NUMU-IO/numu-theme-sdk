import type { LibrarySectionSchema } from "../types";

export const videoSchema: LibrarySectionSchema = {
  type: "lib-video",
  name: "Video",
  name_ar: "فيديو",
  locales: { en: { name: "Video" }, ar: { name: "فيديو" } },
  settings: [
    { type: "header", content: "Video", locales: { ar: { content: "الفيديو" } } },
    {
      id: "video",
      type: "video_picker",
      label: "Video",
      info: "Paste a direct MP4/WebM file URL, or a link from YouTube, Vimeo, Instagram, TikTok or Facebook.",
      locales: {
        ar: {
          label: "الفيديو",
          info: "حط لينك ملف MP4 أو WebM مباشر، أو لينك من يوتيوب أو فيميو أو إنستجرام أو تيك توك أو فيسبوك.",
        },
      },
      default: "",
    },
    {
      id: "poster",
      type: "image_picker",
      label: "Cover image",
      info: "Shown before the video plays.",
      locales: { ar: { label: "صورة الغلاف", info: "بتظهر قبل ما الفيديو يشتغل." } },
      default: "",
    },
    {
      id: "autoplay",
      type: "checkbox",
      label: "Autoplay",
      info: "Plays muted and on repeat while it is on screen. Visitors on data-saver or reduced-motion settings press play themselves.",
      locales: {
        ar: {
          label: "تشغيل تلقائي",
          info: "الفيديو بيشتغل لوحده من غير صوت وبيعيد طول ما هو ظاهر على الشاشة. اللي مفعّلين توفير البيانات أو تقليل الحركة هيدوسوا تشغيل بنفسهم.",
        },
      },
      default: false,
    },
    { type: "header", content: "Content", locales: { ar: { content: "المحتوى" } } },
    { id: "heading", type: "text", label: "Heading", locales: { ar: { label: "العنوان" } }, default: "" },
    { id: "text", type: "textarea", label: "Text", locales: { ar: { label: "الكلام" } }, default: "" },
    { type: "header", content: "Layout", locales: { ar: { content: "الشكل" } } },
    {
      id: "style",
      type: "select",
      label: "Style",
      locales: { ar: { label: "الشكل" } },
      default: "contained",
      options: [
        { value: "contained", label: "Contained, heading above", label_ar: "جوّه الصفحة والعنوان فوقه" },
        { value: "full", label: "Full width, text on the video", label_ar: "بعرض الشاشة والكلام على الفيديو" },
      ],
    },
    {
      id: "aspect",
      type: "select",
      label: "Shape",
      locales: { ar: { label: "المقاس" } },
      default: "16-9",
      options: [
        { value: "16-9", label: "Wide (16:9)", label_ar: "عريض (16:9)" },
        { value: "4-5", label: "Portrait (4:5)", label_ar: "طولي (4:5)" },
        { value: "1-1", label: "Square (1:1)", label_ar: "مربع (1:1)" },
        { value: "9-16", label: "Reel (9:16)", label_ar: "ريل (9:16)" },
      ],
    },
  ],
  presets: [
    {
      name: "Video",
      category: "content",
      locales: { en: { name: "Video" }, ar: { name: "فيديو" } },
      settings: { style: "contained", aspect: "16-9", autoplay: false },
    },
  ],
};
