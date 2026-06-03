// Types
export type { Store, Product, ProductImage, ProductVariant, Collection, Cart, CartItem, Customer, Order, OrderItem, Address, Page } from "./types/entities";
export type { ThemeSettingsV3, PageTemplate, SectionGroup, SectionInstance, BlockInstance, ExternalThemeMetadata, MountResult, SectionSchema, BlockSchema, SettingDefinition, SectionPreset, PresetBlock, SectionProps, BlockProps } from "./types/theme";
export { MAX_BLOCK_DEPTH } from "./types/theme";

// Hooks
export { useShop } from "./hooks/useShop";
export { useProduct, useProductOptional } from "./hooks/useProduct";
export { useCollection, useCollectionOptional } from "./hooks/useCollection";
export { useCart } from "./hooks/useCart";
export { useCustomer } from "./hooks/useCustomer";
export { useThemeSettings } from "./hooks/useThemeSettings";
export { useCurrentTemplate } from "./hooks/useCurrentTemplate";
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

// Phase 8.1 — variant resolution helpers + selection hook.
export {
  findVariantByOptions,
  defaultVariant,
  availableValues,
} from "./utils/variants";
export { useVariantSelection } from "./hooks/useVariantSelection";
export type { UseVariantSelection } from "./hooks/useVariantSelection";
export type { ProductOption } from "./types/entities";

// Phase 8.3 — gift card balance lookup for checkout.
export { useGiftCardBalance } from "./hooks/useGiftCardBalance";
export type {
  GiftCardBalance,
  UseGiftCardBalance,
} from "./hooks/useGiftCardBalance";

// Phase 8.5 — reorder / buy-again.
export { useReorder } from "./hooks/useReorder";
export type {
  ReorderResult,
  ReorderSkipReason,
  ReorderSkippedItem,
  UseReorder,
} from "./hooks/useReorder";

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

// Bundle entry helper — hoists the catalog/global-style/navigation/
// live-preview wiring every theme's `mount()` needs into one place.
export { mountTheme } from "./mount";
export type {
  ThemeMountContext,
  ThemeMountPage,
  ThemeRenderArgs,
} from "./mount";

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

// Wave 4 — inline editor affordances. Themes wrap text and images
// in these so the customizer can click-to-select individual fields
// instead of just whole sections.
export { EditableText, EditableImage } from "./components/Editable";
export type { EditableTextProps, EditableImageProps } from "./components/Editable";

// Shared icon set for the `icon_picker` setting type — themes render a
// merchant-picked icon by name, with identical glyphs in the editor grid
// and on the storefront.
export { Icon, IconMap, ICON_NAMES } from "./components/Icon";
export type { IconProps } from "./components/Icon";

// Utils
export { resolveThemeSettings } from "./utils/normalize";
export { registerSdkSingleton, getSdkSingleton, clearSdkSingleton, registerReactSingleton, getReactSingleton, isSdkAvailable } from "./utils/federation";

// P1.1 — Dynamic sources. Lets a merchant bind a section setting to a
// live store value (product title, collection image, store name, …)
// instead of authoring a literal. The customizer writes
// `{ __numu_source: "<path>" }` into the draft; themes read settings
// through `useResolvedSettings(instance)` to get the resolved value.
export {
  isDynamicSource,
  dynamicSource,
  resolveDynamicValue,
  resolveSourcePath,
  resolveSettingsMap,
} from "./utils/dynamicSources";
export type {
  DynamicSourceRef,
  DynamicResolveContext,
} from "./utils/dynamicSources";
export { useResolvedSettings } from "./hooks/useResolvedSettings";

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
// Phase 3.5 — global settings (colors/fonts/layout) → CSS custom properties.
export { applyGlobalStyleTokens, resolveFontStack } from "./utils/styleTokens";
export {
  flattenMessages,
  pickTranslations,
  buildLocaleBundle,
} from "./utils/locales";
export type { LocaleMessages, LocaleBundle } from "./utils/locales";

// Contexts (for advanced use)
export { ShopContext, ProductContext, CollectionContext, CartContext, CustomerContext, ThemeSettingsContext, LocalizationContext, PageContext, NavigationContext } from "./contexts";
export type { MenuItemData } from "./contexts";
