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
export {
  useLocalization,
  useDirection,
  useLocale,
  useTranslation,
  useFieldTranslation,
  useNumberFormat,
} from "./hooks/useLocalization";
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

// Phase 2.1 hooks — theme-dev parity.
export { useNavigation } from "./hooks/useNavigation";
export type { NavigationItem, NavigationState } from "./hooks/useNavigation";
export { useSearch } from "./hooks/useSearch";
export type { SearchResults, SearchState, UseSearchOptions } from "./hooks/useSearch";
export { useAnalytics } from "./hooks/useAnalytics";
export type { AnalyticsApi, AnalyticsPayload } from "./hooks/useAnalytics";
export { useApp } from "./hooks/useApp";
export type {
  AppState,
  AppPayload,
  AppManifestBlock,
} from "./hooks/useApp";
export { useWishlist } from "./hooks/useWishlist";
export type { WishlistItem, WishlistState } from "./hooks/useWishlist";
export { useRelatedProducts } from "./hooks/useRelatedProducts";
export type { RelatedProductsState } from "./hooks/useRelatedProducts";
export type { ShopWithHelpers } from "./hooks/useShop";

// Phase 6 — multi-currency presentment.
export { useCurrency } from "./hooks/useCurrency";
export type { CurrencyConfig, CurrencyState } from "./hooks/useCurrency";

// Phase 8.1 — variant resolution helpers.
export {
  findVariantByOptions,
  defaultVariant,
  availableValues,
} from "./utils/variants";
export type { ProductOption } from "./types/entities";

// Phase 7 — checkout drivers (themes own the checkout UI).
export { useCheckout } from "./hooks/useCheckout";
export type {
  CheckoutApi,
  CheckoutSessionState,
  CheckoutStep,
  CheckoutAddress,
  ShippingRateOption,
  PlaceOrderResult,
} from "./hooks/useCheckout";
export { useShippingRates } from "./hooks/useShippingRates";
export type {
  UseShippingRatesOptions,
  UseShippingRatesState,
} from "./hooks/useShippingRates";

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

// Phase 2.2 components — opinionated tiles + safe rich-text + switchers.
export { ProductCard } from "./components/ProductCard";
export type { ProductCardProps, ProductCardSlots } from "./components/ProductCard";
export { CollectionCard } from "./components/CollectionCard";
export type { CollectionCardProps, CollectionCardSlots } from "./components/CollectionCard";
export { RichText, sanitizeHtml } from "./components/RichText";
export type { RichTextProps } from "./components/RichText";
export { CurrencySwitcher } from "./components/CurrencySwitcher";
export type { CurrencySwitcherProps } from "./components/CurrencySwitcher";
export { LocaleSwitcher } from "./components/LocaleSwitcher";
export type { LocaleSwitcherProps } from "./components/LocaleSwitcher";

// Utils
export { resolveThemeSettings } from "./utils/normalize";
export { registerSdkSingleton, getSdkSingleton, registerReactSingleton, getReactSingleton, isSdkAvailable } from "./utils/federation";

// Phase 2.5 — section authoring helpers + asset pipeline + locales.
export {
  defineSection,
  defineBlock,
  collectSections,
  collectBlocks,
  isDefinedSection,
  isDefinedBlock,
} from "./utils/defineSection";
export type {
  DefinedSection,
  DefinedBlock,
  DefineSectionInput,
  DefineBlockInput,
} from "./utils/defineSection";
export { assetUrl } from "./utils/assetUrl";
export {
  flattenMessages,
  pickTranslations,
  buildLocaleBundle,
} from "./utils/locales";
export type { LocaleMessages, LocaleBundle } from "./utils/locales";

// Contexts (for advanced use)
export { ShopContext, ProductContext, CollectionContext, CartContext, CustomerContext, ThemeSettingsContext, LocalizationContext, PageContext } from "./contexts";
