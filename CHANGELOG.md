# Changelog

All notable changes to `@numueg/theme-sdk` are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-06-17

### Added

- **Size charts** — `useProductSizeChart()` hook + `resolveSizeChart()` pure
  resolver. Resolves the per-product chart (`product.attributes.size_chart`)
  against the store-wide default (`store.settings.size_chart`) using the same
  precedence as the merchant hub + backend validator (`mode`:
  `custom` → `default` → `off`, with a legacy no-mode fallback). New types
  `SizeChart` / `SizeChartMode`.
- `Product.attributes` and `Store.settings` are now typed (optional
  `Record<string, unknown>`) — the storefront already forwards these JSONB
  blobs (also used by `useFieldTranslation`); they were previously untyped.

## [0.3.0] - 2026-06-10

### Added

- **`defineThemeEntry`** — one-call theme entry that returns both `mount`
  (client, hydration-aware via `hydrateRoot`) and `createApp` (server
  `renderToString`), wiring `NuMuProvider` + page/product/collection context +
  catalog forwarding + global style tokens + the customizer's live-preview
  draft cycle. This is the SSR contract for federated themes.

### Changed

- `mount()` adopts host-server-rendered HTML instead of re-rendering when the
  host passes `hydrate: true`; pure, browser-free global-style-token compute so
  the server render is deterministic.

First public release. Full surface documented at [numueg.app/docs/sdk/overview](https://numueg.app/docs/sdk/overview).

### Added

- **25+ hooks**: `useShop`, `useThemeSettings`, `useLocalization`, `useDirection`, `useTranslation`, `useCurrency`, `usePage`, `useProduct(Optional)`, `useProducts`, `useCollection(Optional)`, `useCollections`, `useVariantSelection`, `useRelatedProducts`, `useCart`, `useCustomer`, `useCustomerActions`, `useCustomerAddresses`, `useOrders`, `useOrder`, `useReorder`, `useGiftCardBalance`, `useCheckout`, `useShippingRates`, `useSearch`, `useNavigation`, `useAnalytics`, `useApp`, `useWishlist`, `useSection(Optional)`, `useImage`, `useMoney`.
- **15+ components**: `NuMuProvider`, `ProductProvider`, `CollectionProvider`, `Section`, `Block`, `Image`, `Money`, `Link`, `Form`, `AddToCartButton`, `ProductCard`, `CollectionCard`, `RichText`, `CurrencySwitcher`, `LocaleSwitcher`, `CookieConsent`.
- **Variant helpers**: `findVariantByOptions`, `defaultVariant`, `availableValues`.
- **Federation runtime helpers**: `registerSdkSingleton`, `getSdkSingleton`, `registerReactSingleton`, `getReactSingleton`, `isSdkAvailable`.
- **Asset + format helpers**: `assetUrl`, `sanitizeHtml`, `resolveThemeSettings`.
- Dual ESM + CJS build via `tsup` with full `.d.ts` types.
- React 18 + 19 supported via `peerDependencies`.
