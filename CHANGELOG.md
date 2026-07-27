# Changelog

All notable changes to `@numueg/theme-sdk` are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.12.0] - unreleased

Metafields, blog/article content, and the shared template-resolution engine.
Purely **additive** at the API surface — 16 new runtime exports, zero removals
versus 0.10.1 (verified by diffing the published tarball's export list).

### Added

- **`useListingHeading(options)`** — resolves the title/subtitle a listing
  (collection / all-products / search) should render, so every theme's product
  grid agrees on the heading source. New types `ListingHeading`,
  `ListingHeadingOptions`.
- **Template + section-group resolution** — `resolveSections`,
  `selectTemplateSections`, `selectChromeSections`, plus types
  `MaybeOrderedTemplate` and `ResolvedSection`. This is the "no blank page"
  engine that was previously copy-pasted as `_template-utils.ts` into 14
  themes. Headless: it decides WHICH sections render, never how they look.
- **`useMetafield` / `useMetafields`** — first-class read access to
  merchant-defined typed fields, complementing the dynamic-source binding path
  (`{owner}.metafield:{namespace}.{key}`). Public metafields only. New type
  `MetafieldOwner`.
- **`useBlogs` / `useBlog` / `useArticles` / `useArticle`** — blog CMS content
  the host resolves into `page.data` for the blogs/blog/article templates. New
  types `BlogSummary`, `ArticleSummary`, `ArticleDetail`. Article bodies are
  UN-sanitized merchant HTML — render through `<RichText>`, never raw
  `dangerouslySetInnerHTML`.

## [0.11.0] - unreleased

Superseded by 0.12.0 — never published to npm.

### Added

- **`productHref` / `collectionHref`** — storefront route builders. The URL
  shape is platform knowledge, so themes ask for a href instead of hardcoding
  the host's routing. `ProductCard` now uses `productHref` internally, so a
  card and a theme's own links can't disagree about the product route.
- **Money primitives** — `formatMoney`, `formatMoneyMajor`, `centsToMajor`,
  `majorToCents` and the `FormatMoneyOptions` type. EGP fallback, whole pounds,
  `ar-EG` — matching what the fleet renders today, NOT theme-kit's generic
  USD/2-digit default.
- **Metafield dynamic sources** — `product.metafield:{ns}.{key}` and
  `collection.metafield:{ns}.{key}` resolve through `resolveSourcePath`; new
  `Metafield` type and `metafields?: Metafield[]` on `Product` / `Collection`.

### Changed

- **BREAKING (behaviour, not signature): `applyImageTransform(undefined)` now
  returns `{}` instead of `{ objectFit: fit }`.** An inline style beats a
  className, so the old default silently overrode a placement's own
  `object-contain` / `object-none` class on every UNtransformed image — which
  is most merchant images. The section's className is back in charge; callers
  that need a guaranteed fit supply it themselves, e.g.
  `{ objectFit: fit, ...applyImageTransform(t, fit) }`. `HeroMedia` was updated
  accordingly. The TypeScript signature is unchanged, so this will NOT surface
  as a compile error in a consuming theme.

## [0.10.1] - 2026-07-23

Analytics correctness. No API additions or removals (export surface identical
to 0.10.0).

### Fixed

- **`dispatchAnalyticsEvent` mints ONE `event_id` for both channels.** The
  `numu:analytics:event` CustomEvent now carries `detail.event_id` and the
  `/track` POST reuses the same id. The host's Meta/TikTok pixel bridges read
  `detail.event_id`, so theme-fired events dedupe browser-vs-server instead of
  double-counting on both platforms. Previously the CustomEvent had no id at
  all while the POST minted its own.
- **`CartMutationResult` gains the applied `cart`** (major units, same
  normalization as `useCart().cart`) so callers can read written state without
  racing React state. Absent on failure.
- **`addItem`'s browser `AddToCart` event includes `value` + `currency`**,
  derived from the written line's snapshot price (variant-aware), making the
  event usable for value-based ad optimization and dynamic ads.

## [0.10.0] - 2026-07-04

### Added

- **Soft navigation** — `<Link>` dispatches a cancelable `numu:navigate` event
  so the host can route client-side instead of doing a full document load.
- **Variant selection registry** — live picker axes act as a `variant_name`
  fallback when a product's variants carry no structured options.

## [0.9.0] - 2026-07-04

Template epic I3 — the SDK side of template overrides + global sections shared
across pages. Additive: three new/extended surfaces, no breaking changes. As
always, self-contained theme bundles freeze the SDK at build time, so themes
must be **rebuilt + redeployed** to pick these up.

### Added

- **`useSectionGroup(group)`** — returns the ordered section instances for a
  named section group ("header", "footer", or any custom global group) from
  `themeSettings.section_groups[group]`. Each entry re-attaches its `id` (the
  key it held in the group's `sections` map) so a theme can key its React list,
  wire `<Section id={…}>` click-to-select, and dispatch the `type` through its
  OWN registry. Returns a stable `[]` when there is no provider, no
  `section_groups`, the group is absent, or its `order` is empty. Disabled
  instances are included (the `disabled` flag is preserved); ids in `order` but
  missing from `sections` are skipped. New export `useSectionGroup` + type
  `SectionGroupInstance` (`SectionInstance & { id: string }`).

  No `<GlobalSections>` component ships: the SDK has no section registry — a
  theme builds its own via `collectSections` — so there is no generic renderer
  to expose. Themes render the returned instances through their existing
  registry, exactly as they already do for template sections.

- **`Page.template` (+ `ThemeMountPage.template`)** — an optional resolved
  alternate template key surfaced via `usePage()?.template`, e.g.
  `"product.wholesale"` for a product routed to the `wholesale` template
  suffix. Distinct from `useCurrentTemplate()` / `page.type`, which stay the
  base route type (`"product"`); `template` carries the FULL key a theme uses
  to look up `themeSettings.templates[template]`. Hosts forward it in the mount
  context's `page.template`; `mountTheme` threads it to `NuMuProvider`'s new
  optional `pageTemplate` prop, which publishes it on the `PageContext` value.
  Omitted for pages on their default template, so themes/hosts predating the
  field are unaffected.

## [0.8.0] - 2026-07-04

Phase 3 (shared client-data layer). Additive — a new primitive plus internal
refactors of three hooks onto it. As always, self-contained theme bundles
freeze the SDK at build time, so themes must be **rebuilt + redeployed** to pick
these up.

### Added

- **`useCachedResource<T>(key, fetcher, opts?)`** — a tiny, dependency-free
  SWR-style client cache (new `@numueg/theme-sdk` export, `src/lib/dataCache.ts`).
  One module-level store keyed by string gives themes and SDK hooks:
  - **Dedup** — the first consumer of a key starts the fetch and stashes the
    in-flight promise; every other consumer that revalidates the same key while
    it's pending joins that promise. N consumers → ONE network call.
  - **Cross-instance sync** — every instance subscribes via
    `useSyncExternalStore`; a fetch resolve or `mutate` rebuilds the entry's
    snapshot and notifies ALL subscribers, so they re-render in lockstep.
  - **Revalidate + cancellation** — each fetch reserves a monotonic sequence and
    an `AbortController`; a forced fetch aborts the previous one and a result is
    applied only if its sequence is still the latest, so an out-of-order
    (superseded) response can never overwrite a newer one.
  - **SSR-safe** — the fetch is effect-only (never runs under `renderToString`)
    and the server snapshot returns `initialData` without touching the module
    cache (no cross-request bleed).

  New types: `CachedResource`, `CachedResourceState`, `CacheFetcher`,
  `CacheMutator`, `MutateOptions`, `UseCachedResourceOptions`.

### Fixed

- **Wishlist hearts no longer desync.** `useWishlist` held the item list in
  per-instance `useState`, so two `<Heart>`s for the same product each owned a
  copy — adding via one never re-rendered the other. It now reads/writes ONE
  shared `useCachedResource` entry (`numu_wishlist_<store_id>`), so an
  add/remove anywhere reflows every heart. Writes are optimistic and roll back
  if `localStorage` persistence throws (quota / private mode).
- **`useApp` no longer applies out-of-order responses.** The per-instance fetch
  had no cancellation, so a slow reply for a superseded slug (or a superseded
  `refresh()`) could apply stale state over a newer one. It now runs through
  `useCachedResource` (keyed `numu:app:<store_id>:<slug>`) with an AbortSignal
  and seq-guarded application; N consumers of one slug also share a single
  request. `loading` reflects the first load only — `refresh()` now revalidates
  in the background while keeping the last-good data (no skeleton flash).
- **`useRelatedProducts` dedupes + cancels.** Two related-products sections on
  one PDP shared no state and each refetched; a rapid product switch could race.
  Now keyed by `numu:related:<productId>:<limit>` through the shared cache, with
  AbortSignal-backed cancellation of superseded fetches. Public shape unchanged.

## [0.7.0] - 2026-07-04

Phase 2 (correctness debt). Changes are additive or bug fixes; note that
self-contained theme bundles freeze the SDK at build time, so themes must be
**rebuilt + redeployed** to pick these up.

### Fixed

- **`/v2-compat` shared contexts.** `tsup` now builds with `splitting: true`, so
  the context module (its ~12 `createContext()` calls) is hoisted into ONE shared
  chunk imported by both `dist/index.*` and `dist/v2-compat.*`. Under the old
  `splitting: false`, the `v2-compat` entry bundled its OWN copies, so
  `useV2Products()` / `useV2Theme()` / … read null contexts that `NuMuProvider`
  never populated and the documented V2→V3 migration path silently failed.
  Verified for both esm + cjs; the pure `validation` / `verify` / `normalize`
  entries stay React-free.
- **Multi-currency now propagates to `<Money>`.** The currency config, selection
  and `convert()` are lifted into a new `CurrencyContext`, fetched ONCE by
  `NuMuProvider` (previously `useCurrency()` fetched `/api/storefront/currencies`
  and held the selection in per-component state, and `<Money>` ignored it
  entirely). `<Money>` and `useMoney()` now present amounts in the visitor's
  selected currency when the store has `auto_convert` on and no explicit
  `currency` is pinned, so a `<CurrencySwitcher>` change reflows every price on
  the page without a reload. SSR-safe: the selection starts empty on the server
  and first client render, then converts post-hydration.
- **Cart mutation failures are no longer swallowed.** The cart methods
  (`addItem` / `removeItem` / `updateQuantity` / `applyDiscount` /
  `removeDiscount` / `updateNote`) now resolve a `CartMutationResult`
  (`{ ok, status, message }`) instead of `void`. A non-2xx response
  (out-of-stock, validation, 403 CSRF) resolves `{ ok: false, … }` and does NOT
  apply a cart, and `addItem` gates its `add_to_cart` analytics event on `ok`
  so a failed add no longer reports a phantom conversion. Back-compat: callers
  that `await` these and ignore the return are unaffected.
- **RichText SSR sanitizer hardened.** The DOM-free server path (what ships in
  the first paint before hydration) now (a) strips inline event handlers with a
  broadened separator class `[\s/"'<]` so `<img/onerror=…>` is caught, (b)
  strips dangerous element blocks to a fixpoint so nested/spliced `<script>`
  can't reconstitute after one pass, and (c) drops non-allowlisted `href`/`src`
  URLs (`javascript:` / `data:` / …). The client path remains the structural
  DOMParser allowlist.

### Added

- `SectionProps` is now generic over its settings —
  `SectionProps<S = Record<string, unknown>>` with `settings: S` — and carries
  `id: string`, `type: string`, `groupId?: string`, so themes can drop their
  hand-rolled per-theme section-props interfaces (`EmpSectionProps`).
- New exports (via `@numueg/theme-sdk`): `CurrencyContext`, and the types
  `CartMutationResult` and `CartContextValue`.

### Changed

- **(Semi-breaking, TypeScript only)** `SectionProps` gains REQUIRED `id`/`type`
  and its default `settings` type tightens from `Record<string, any>` to
  `Record<string, unknown>`. Themes that referenced `SectionProps` directly
  (most hand-rolled their own props, so real-world impact is small) may need to
  narrow `settings` access or pass a settings type argument. Runtime behavior is
  unchanged.

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
