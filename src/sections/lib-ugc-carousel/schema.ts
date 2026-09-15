import type { LibrarySectionSchema } from "../types";

const VIDEO_INFO = "Paste a direct MP4/WebM file URL, or a link from YouTube, Vimeo, Instagram, TikTok or Facebook.";
const VIDEO_INFO_AR = "حط لينك ملف MP4 أو WebM مباشر، أو لينك من يوتيوب أو فيميو أو إنستجرام أو تيك توك أو فيسبوك.";

const reel = (n: number): LibrarySectionSchema["settings"] => [
  { type: "header", content: `Reel ${n}`, locales: { ar: { content: `ريل ${n}` } } },
  {
    id: `item_${n}_media`,
    type: "image_picker",
    label: `Reel ${n} poster image`,
    locales: { ar: { label: `صورة الغلاف (ريل ${n})` } },
    aspect_ratio: "3/4",
    default: "",
  },
  {
    id: `item_${n}_video`,
    type: "video_picker",
    label: `Reel ${n} video link`,
    info: VIDEO_INFO,
    locales: { ar: { label: `لينك الفيديو (ريل ${n})`, info: VIDEO_INFO_AR } },
    default: "",
  },
  { id: `item_${n}_caption`, type: "text", label: `Reel ${n} caption`, locales: { ar: { label: `التعليق (ريل ${n})` } }, default: "" },
  {
    id: `item_${n}_product_image`,
    type: "image_picker",
    label: `Reel ${n} product thumbnail`,
    locales: { ar: { label: `صورة المنتج (ريل ${n})` } },
    aspect_ratio: "1/1",
    default: "",
  },
  {
    id: `item_${n}_product_link`,
    type: "url",
    label: `Reel ${n} product link`,
    locales: { ar: { label: `رابط المنتج (ريل ${n})` } },
    default: "",
  },
];

/**
 * Setting ids match Vionne's `vionne-ugc-carousel` one-for-one (the contract
 * frozen in docs/Plans/theme-section-base/PHASE-0-DECISIONS-AND-BASELINE.md
 * § 0.5). The autoplay and product-field Arabic was approved by the owner.
 */
export const ugcCarouselSchema: LibrarySectionSchema = {
  type: "lib-ugc-carousel",
  name: "Shopper reels",
  name_ar: "ريلز العملاء",
  locales: { en: { name: "Shopper reels" }, ar: { name: "ريلز العملاء" } },
  settings: [
    { type: "header", content: "Content", locales: { ar: { content: "المحتوى" } } },
    { id: "eyebrow", type: "text", label: "Eyebrow", locales: { ar: { label: "نص صغير فوق العنوان" } }, default: "" },
    { id: "title", type: "text", label: "Title", locales: { ar: { label: "العنوان" } }, default: "" },
    { id: "subtitle", type: "text", label: "Subtitle", locales: { ar: { label: "العنوان الفرعي" } }, default: "" },
    { id: "cta_text", type: "text", label: "Button text", locales: { ar: { label: "كلام الزرار" } }, default: "" },
    { id: "cta_link", type: "url", label: "Button link", locales: { ar: { label: "لينك الزرار" } }, default: "/products" },
    {
      id: "intro_image",
      type: "image_picker",
      label: "Intro card image",
      locales: { ar: { label: "صورة كارت المقدمة" } },
      aspect_ratio: "3/4",
      default: "",
    },
    { id: "badge_text", type: "text", label: "Product badge text", locales: { ar: { label: "كلام زرار الشراء" } }, default: "" },
    ...reel(1),
    ...reel(2),
    ...reel(3),
    ...reel(4),
    ...reel(5),
    ...reel(6),
    { type: "header", content: "Playback", locales: { ar: { content: "التشغيل" } } },
    {
      id: "autoplay",
      type: "checkbox",
      label: "Autoplay videos",
      info: "Plays reels automatically, muted, as they scroll into view. Only the most visible few play at once. Visitors on data-saver or reduced-motion settings tap to play.",
      locales: {
        ar: {
          label: "تشغيل الفيديوهات تلقائي",
          info: "الريلز بتشتغل لوحدها من غير صوت أول ما تبان على الشاشة، وأكتر كام ريل ظاهرين بس هما اللي بيشتغلوا. اللي مفعّلين توفير البيانات أو تقليل الحركة هيدوسوا عشان يشغّلوا.",
        },
      },
      default: true,
    },
  ],
  presets: [
    {
      name: "Shopper reels",
      category: "marketing",
      locales: { en: { name: "Shopper reels" }, ar: { name: "ريلز العملاء" } },
      settings: { cta_link: "/products", autoplay: true },
    },
  ],
};
