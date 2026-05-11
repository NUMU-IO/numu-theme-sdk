# @numueg/theme-sdk

> React hooks + components + helpers for building NUMU storefront themes.

[![npm](https://img.shields.io/npm/v/@numueg/theme-sdk.svg)](https://www.npmjs.com/package/@numueg/theme-sdk)
[![license](https://img.shields.io/npm/l/@numueg/theme-sdk.svg)](./LICENSE)

The SDK every NUMU theme consumes. 25+ hooks (`useCart`, `useProduct`, `useCheckout`, `useVariantSelection`, `useGiftCardBalance`, …), 15+ components (`AddToCartButton`, `ProductCard`, `Money`, `Section`, `NuMuProvider`, …), and helpers for variant resolution, asset URLs, and federation singletons.

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

```tsx
import { createRoot } from "react-dom/client";
import { NuMuProvider, useCart, AddToCartButton } from "@numueg/theme-sdk";
import type { MountContext } from "@numueg/theme-sdk";

function App() {
  const { cart } = useCart();
  return <p>Items in cart: {cart.item_count}</p>;
}

export function mount(ctx: MountContext) {
  const root = createRoot(document.getElementById("numu-root")!);
  root.render(<NuMuProvider {...ctx}><App /></NuMuProvider>);
  return () => root.unmount();
}
```

## Docs

- [SDK Overview](https://numueg.app/docs/sdk/overview)
- [Hooks Reference](https://numueg.app/docs/sdk/hooks)
- [Components Reference](https://numueg.app/docs/sdk/components)
- [Type Definitions](https://numueg.app/docs/sdk/types)

## React versions

Supports React 18 and 19. Declared via `peerDependencies`.

## License

MIT — see [LICENSE](./LICENSE).
