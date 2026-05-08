/**
 * `assetUrl(name)` — resolve a theme-bundled asset's runtime URL.
 *
 * Themes ship static assets (images, fonts, JSON) under `assets/`.
 * The plugin copies each asset to `dist/assets/` with a content-hashed
 * filename and writes a manifest (`asset-manifest.json`) mapping each
 * source path to the hashed name.
 *
 * At runtime this function reads the manifest off the runtime window
 * object (`window.__NUMU_ASSET_MANIFEST`) — populated by the storefront's
 * `<RuntimeImportMap>` component when the theme bundle is loaded —
 * and returns the absolute URL to the hashed file.
 *
 * Why a runtime helper instead of bake-time string interpolation:
 *   The same theme bundle is reused across hosted stores. The asset
 *   base URL differs per environment (CDN vs local dev) and per store
 *   (subdomain vs custom domain). Resolving at runtime keeps a single
 *   bundle deployable across all of them.
 *
 * Usage:
 *   <Image src={assetUrl("hero.jpg")} alt="..." />
 *   <link rel="preload" as="font" href={assetUrl("fonts/Inter.woff2")} />
 *
 * Behavior when the manifest is missing or the asset isn't listed:
 *   Returns the original `name` (prefixed with the conventional
 *   `/assets/` path) as a fallback. This keeps dev workable when the
 *   plugin's asset-pipeline step hasn't run yet, and surfaces obviously-
 *   wrong asset names as 404s rather than silent failures.
 */

interface AssetManifest {
  /** Map of source asset path → hashed filename in dist/assets/ */
  [sourcePath: string]: string;
}

interface AssetRuntimeConfig {
  /** Manifest written by the plugin at build time and injected at runtime. */
  __NUMU_ASSET_MANIFEST?: AssetManifest;
  /**
   * Optional CDN/path prefix. Defaults to "/assets/" — themes hosted on
   * a CDN can override by setting this on `window` before mount.
   */
  __NUMU_ASSET_BASE_URL?: string;
}

function getRuntime(): AssetRuntimeConfig {
  if (typeof window === "undefined") return {};
  return window as unknown as AssetRuntimeConfig;
}

export function assetUrl(name: string): string {
  if (!name) return "";
  // Already-absolute or already-resolved (starts with /, http://, https://) →
  // pass through. Theme code that mixes hand-written paths with assetUrl()
  // is fine, this is just a no-op for those.
  if (/^https?:\/\//i.test(name) || name.startsWith("//")) return name;

  const runtime = getRuntime();
  const manifest = runtime.__NUMU_ASSET_MANIFEST;
  const base = runtime.__NUMU_ASSET_BASE_URL || "/assets/";

  // Normalize: strip leading "./" or "assets/" so callers can write
  // `assetUrl("hero.jpg")` or `assetUrl("./hero.jpg")` interchangeably.
  let key = name.replace(/^\.\//, "");
  if (key.startsWith("/")) key = key.slice(1);
  if (key.startsWith("assets/")) key = key.slice("assets/".length);

  const hashed = manifest?.[key];
  // No manifest hit → fall back to the bare path under base. Keeps dev
  // (where the plugin watch hasn't emitted a manifest yet) workable.
  const filename = hashed || key;
  // Ensure exactly one slash between base and filename.
  const cleanBase = base.endsWith("/") ? base : `${base}/`;
  return `${cleanBase}${filename}`;
}
