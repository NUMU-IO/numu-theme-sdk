import type { LibrarySectionSchema } from "../types";

export const bundleBuilderSchema: LibrarySectionSchema = {
  type: "lib-bundle-builder",
  name: "Bundle builder",
  name_ar: "كوّن باقتك",
  locales: { en: { name: "Bundle builder" }, ar: { name: "كوّن باقتك" } },
  settings: [
    { id: "heading", type: "text", label: "Heading", locales: { ar: { label: "العنوان" } }, default: "" },
    {
      id: "subheading",
      type: "text",
      label: "Text under the heading",
      info: "Leave empty to hide it.",
      locales: { ar: { label: "الكلام اللي تحت العنوان", info: "سيبه فاضي لو مش عايزه يظهر." } },
    },
    {
      id: "pick_count",
      type: "range",
      label: "How many products the shopper picks",
      locales: { ar: { label: "عدد المنتجات اللي الزبون يختارها" } },
      default: 3,
      min: 2,
      max: 6,
      step: 1,
    },
    { type: "header", content: "Products", locales: { en: { content: "Products" }, ar: { content: "المنتجات" } } },
    {
      id: "source",
      type: "select",
      label: "Products to pick from",
      info: "Stores with more than 100 products may see some missing from a collection or tag.",
      locales: {
        ar: {
          label: "المنتجات اللي الزبون يختار منها",
          info: "لو متجرك فيه أكتر من 100 منتج، ممكن شوية منتجات من التصنيف أو التاج ما يظهروش.",
        },
      },
      default: "collection",
      options: [
        { value: "collection", label: "From a collection", label_ar: "من تصنيف" },
        { value: "tag", label: "With a tag", label_ar: "بتاج معيّن" },
        { value: "product_list", label: "Products I pick", label_ar: "منتجات بتختارها بنفسك" },
      ],
    },
    {
      id: "collection",
      type: "collection",
      label: "Collection",
      info: "Used when \"From a collection\" is picked.",
      locales: { ar: { label: "التصنيف", info: "بيتستخدم لما تختار «من تصنيف»." } },
    },
    {
      id: "tag",
      type: "text",
      label: "Tag",
      info: "Used when \"With a tag\" is picked.",
      locales: { ar: { label: "التاج", info: "بيتستخدم لما تختار «بتاج معيّن»." } },
      default: "",
    },
    {
      id: "product_list",
      type: "product_list",
      label: "Products",
      info: "Used when \"Products I pick\" is picked. Shown in this order.",
      locales: { ar: { label: "المنتجات", info: "بيتستخدم لما تختار «منتجات بتختارها بنفسك»، وبتظهر بنفس الترتيب." } },
    },
    {
      id: "limit",
      type: "range",
      label: "How many products to show",
      locales: { ar: { label: "عدد المنتجات اللي تظهر" } },
      default: 12,
      min: 4,
      max: 24,
      step: 1,
    },
    { type: "header", content: "Offer price", locales: { en: { content: "Offer price" }, ar: { content: "سعر العرض" } } },
    {
      type: "paragraph",
      content:
        "This section never makes up a discount. The offer price comes from an automatic \"Any N for a fixed price\" discount with the same number of products, created in Discounts in your dashboard. Without one, shoppers see the regular total.",
      locales: {
        en: {
          content:
            "This section never makes up a discount. The offer price comes from an automatic \"Any N for a fixed price\" discount with the same number of products, created in Discounts in your dashboard. Without one, shoppers see the regular total.",
        },
        ar: {
          content:
            "السكشن ده مش بيعمل خصم من عنده. سعر العرض بييجي من خصم تلقائي «أي عدد بسعر ثابت» بنفس عدد المنتجات، بتعمله من «الخصومات» في لوحة التحكم. من غيره الزبون هيشوف السعر العادي.",
        },
      },
    },
    {
      id: "show_offer",
      type: "checkbox",
      label: "Show the offer price from my discounts",
      locales: { ar: { label: "اظهر سعر العرض من الخصومات بتاعتي" } },
      default: true,
    },
    { type: "header", content: "Layout", locales: { en: { content: "Layout" }, ar: { content: "الشكل" } } },
    {
      id: "style",
      type: "select",
      label: "Style",
      locales: { ar: { label: "طريقة العرض" } },
      default: "grid",
      options: [
        { value: "grid", label: "Grid with the summary below", label_ar: "شبكة والملخص تحتها" },
        { value: "sticky", label: "Summary that stays in view", label_ar: "ملخص ثابت قدّام الزبون" },
      ],
    },
    {
      id: "button_text",
      type: "text",
      label: "Button text",
      locales: { ar: { label: "كلام الزرار" } },
      default: "",
    },
  ],
  presets: [
    {
      name: "Bundle builder",
      category: "products",
      locales: { en: { name: "Bundle builder" }, ar: { name: "كوّن باقتك" } },
      settings: {},
    },
  ],
};
