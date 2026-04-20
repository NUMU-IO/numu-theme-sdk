// Types
export type { Store, Product, ProductImage, ProductVariant, Collection, Cart, CartItem, Customer, Order, OrderItem, Address, Page } from "./types/entities";
export type { ThemeSettingsV3, PageTemplate, SectionGroup, SectionInstance, BlockInstance, ExternalThemeMetadata, SectionSchema, BlockSchema, SettingDefinition, SectionPreset, SectionProps, BlockProps } from "./types/theme";

// Hooks
export { useShop } from "./hooks/useShop";
export { useProduct, useProductOptional } from "./hooks/useProduct";
export { useCollection, useCollectionOptional } from "./hooks/useCollection";
export { useCart } from "./hooks/useCart";
export { useCustomer } from "./hooks/useCustomer";
export { useThemeSettings } from "./hooks/useThemeSettings";
export { useLocalization, useDirection, useTranslation } from "./hooks/useLocalization";
export { usePage } from "./hooks/usePage";
export { useSection, useSectionOptional, SectionContext } from "./hooks/useSection";

// Components
export { NuMuProvider } from "./components/NuMuProvider";
export { ProductProvider } from "./components/ProductProvider";
export { CollectionProvider } from "./components/CollectionProvider";

// Utils
export { resolveThemeSettings } from "./utils/normalize";
export { registerSdkSingleton, getSdkSingleton, registerReactSingleton, getReactSingleton, isSdkAvailable } from "./utils/federation";

// Contexts (for advanced use)
export { ShopContext, ProductContext, CollectionContext, CartContext, CustomerContext, ThemeSettingsContext, LocalizationContext, PageContext } from "./contexts";
