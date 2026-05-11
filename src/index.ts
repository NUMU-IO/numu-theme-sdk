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
export { useMoney } from "./hooks/useMoney";
export { useImage } from "./hooks/useImage";
export { useProducts } from "./hooks/useProducts";
export { useCollections } from "./hooks/useCollections";
export { useCustomerActions } from "./hooks/useCustomerActions";
export { useOrders, useOrder } from "./hooks/useOrders";
export type { OrderListEntry, OrderListState, OrderDetail, OrderState } from "./hooks/useOrders";
export { useCustomerAddresses } from "./hooks/useCustomerAddresses";
export type { CustomerAddress, AddressInput, CustomerAddressesState } from "./hooks/useCustomerAddresses";

// Components
export { NuMuProvider } from "./components/NuMuProvider";
export { ProductProvider } from "./components/ProductProvider";
export { CollectionProvider } from "./components/CollectionProvider";
export { Money } from "./components/Money";
export { Image } from "./components/Image";
export { Link } from "./components/Link";
export { AddToCartButton } from "./components/AddToCartButton";
export { Section, Block } from "./components/Section";
export { Form } from "./components/Form";

// Utils
export { resolveThemeSettings } from "./utils/normalize";
export { registerSdkSingleton, getSdkSingleton, registerReactSingleton, getReactSingleton, isSdkAvailable } from "./utils/federation";

// Contexts (for advanced use)
export { ShopContext, ProductContext, CollectionContext, CartContext, CustomerContext, ThemeSettingsContext, LocalizationContext, PageContext } from "./contexts";
