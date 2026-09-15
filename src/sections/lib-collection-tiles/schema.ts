import type { LibrarySectionSchema } from "../types";

export const collectionTilesSchema: LibrarySectionSchema = {
  type: "lib-collection-tiles",
  name: "Shop by category",
  name_ar: "تسوّق حسب التصنيف",
  locales: { en: { name: "Shop by category" }, ar: { name: "تسوّق حسب التصنيف" } },
  settings: [
    {
      id: "style",
      type: "select",
      label: "Style",
      locales: { ar: { label: "الشكل" } },
      default: "tiles",
      options: [
        { value: "tiles", label: "Tiles — image with the name", label_ar: "مربعات: صورة وتحتها الاسم" },
        { value: "card", label: "Label cards — name card over the image", label_ar: "كارت الاسم فوق الصورة" },
        { value: "circles", label: "Circles — round images", label_ar: "دواير: صور مدوّرة" },
      ],
    },
    { id: "title", type: "text", label: "Heading", locales: { ar: { label: "العنوان" } }, default: "" },
    {
      id: "show_counts",
      type: "checkbox",
      label: "Show how many products",
      info: "Only for your collections, when the count is known.",
      locales: { ar: { label: "اظهر عدد المنتجات", info: "للتصنيفات بتاعة متجرك بس، لما العدد يكون معروف." } },
      default: true,
    },
    {
      id: "view_all_link",
      type: "url",
      label: "\"View all\" link",
      info: "Leave empty to hide the link.",
      locales: { ar: { label: "لينك «شوف الكل»", info: "سيبه فاضي لو مش عايز اللينك يظهر." } },
      default: "/collections",
    },
    {
      id: "source",
      type: "select",
      label: "Where the tiles come from",
      info: "\"Your collections\" updates on its own as you add categories. Choose \"Tiles I add below\" for a curated set with your own photos.",
      locales: {
        ar: {
          label: "المربعات جاية منين",
          info: "«تصنيفات متجرك» بتتحدّث لوحدها كل ما تضيف تصنيف. اختار «المربعات اللي تحت» لو عايز مجموعة مختارة بصورك.",
        },
      },
      default: "auto",
      options: [
        { value: "auto", label: "Your collections", label_ar: "تصنيفات متجرك" },
        { value: "manual", label: "Tiles I add below", label_ar: "المربعات اللي تحت" },
      ],
    },
    {
      id: "limit",
      type: "range",
      label: "How many collections",
      locales: { ar: { label: "عدد التصنيفات" } },
      default: 8,
      min: 2,
      max: 16,
      step: 1,
    },
    {
      id: "columns_desktop",
      type: "range",
      label: "Tiles per row (desktop)",
      info: "Phones always show two per row.",
      locales: { ar: { label: "عدد المربعات في الصف (كمبيوتر)", info: "على الموبايل بيبان اتنين في الصف دايمًا." } },
      default: 4,
      min: 2,
      max: 6,
      step: 1,
    },
    {
      id: "aspect",
      type: "select",
      label: "Image shape",
      locales: { ar: { label: "شكل الصورة" } },
      default: "portrait",
      options: [
        { value: "portrait", label: "Portrait (3:4)", label_ar: "طولي (3:4)" },
        { value: "square", label: "Square", label_ar: "مربع" },
        { value: "landscape", label: "Landscape (4:3)", label_ar: "عرضي (4:3)" },
      ],
    },
    {
      id: "label_position",
      type: "select",
      label: "Name position",
      locales: { ar: { label: "مكان الاسم" } },
      default: "below",
      options: [
        { value: "below", label: "Under the image", label_ar: "تحت الصورة" },
        { value: "overlay", label: "On the image", label_ar: "على الصورة" },
      ],
    },
  ],
  blocks: [
    {
      type: "tile",
      name: "Tile",
      name_ar: "مربع",
      locales: { en: { name: "Tile" }, ar: { name: "مربع" } },
      settings: [
        { id: "image", type: "image_picker", label: "Image", locales: { ar: { label: "الصورة" } }, default: "" },
        { id: "label", type: "text", label: "Name", locales: { ar: { label: "الاسم" } }, default: "" },
        { id: "link", type: "url", label: "Link", locales: { ar: { label: "اللينك" } }, default: "/collections" },
      ],
    },
  ],
  max_blocks: 12,
  presets: [
    {
      name: "Shop by category",
      category: "products",
      locales: { en: { name: "Shop by category" }, ar: { name: "تسوّق حسب التصنيف" } },
      settings: {},
    },
  ],
};
