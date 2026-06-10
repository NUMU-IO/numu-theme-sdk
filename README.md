# @numueg/theme-sdk

> React hooks + components + helpers for building NUMU storefront themes.

[![npm](https://img.shields.io/npm/v/@numueg/theme-sdk.svg)](https://www.npmjs.com/package/@numueg/theme-sdk)
[![license](https://img.shields.io/npm/l/@numueg/theme-sdk.svg)](./LICENSE)

The SDK every NUMU theme consumes. The `mountTheme()` runtime helper, 27+ hooks (`useCart`, `useProduct`, `useCheckout`, `useVariantSelection`, `useCurrentTemplate`, `useResolvedSettings`, …), 15+ components (`AddToCartButton`, `ProductCard`, `Money`, `Section`, `EditableText`/`EditableImage`, `NuMuProvider`, …), and helpers for variant resolution, focal image crops (`focalSrc`), global style tokens, asset URLs, and federation singletons.

Themes import via the bare specifier `@numueg/theme-sdk` — at runtime the storefront's import map resolves it to the host-loaded singleton so every theme on the platform shares one React identity.

## Install

```bash
npm install --save-peer @numueg/theme-sdk react react-dom
```

Then externalize all three in `vite.config.ts`:

```ts
export default defineConfig({
  build: {
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "react-dom/client", "@numueg/theme-sdk"],
    },
  },
});
```

The `@numueg/theme-plugin` Vite plugin does this for you automatically.

## Usage

The host storefront calls your bundle's `mount(el, ctx)` where `ctx = { storeData, page, themeSettings, locale, … }`. Use `mountTheme()` — it wires catalog data, global style tokens, navigation, and live-edit updates for you and returns the `{ unmount, update }` contract the host expects:

```tsx
import { mountTheme, useCart } from "@numueg/theme-sdk";

function App() {
  const { cart } = useCart();
  return <p>Items in cart: {cart.item_count}</p>;
}

export function mount(el: HTMLElement, ctx: unknown) {
  return mountTheme(el, ctx, () => <App />);
}
```

> The authoritative `ctx` shape is defined by the host's `ByotThemeBoundary` (numu-storefront), not by SDK types — accept it as opaque and let `mountTheme`/`NuMuProvider` normalize it.

## Docs

- [SDK Overview](https://numueg.app/docs/sdk/overview)
- [Hooks Reference](https://numueg.app/docs/sdk/hooks)
- [Components Reference](https://numueg.app/docs/sdk/components)
- [Type Definitions](https://numueg.app/docs/sdk/types)

## React versions

Supports React 18 and 19. Declared via `peerDependencies`.

## License

MIT — see [LICENSE](./LICENSE).
