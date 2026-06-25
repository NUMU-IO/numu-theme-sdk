/**
 * Engine-level logo appearance (shape + size).
 *
 * A merchant can crop the store logo into a shape and pick its size from the
 * theme editor's global settings (`logo_shape` / `logo_size`). The logic lives
 * here — once, in the SDK — so EVERY V3 theme renders the chosen shape the same
 * way instead of each theme re-implementing it.
 *
 * Why inline styles (not Tailwind classes): the SDK is consumed from
 * `node_modules`, which a theme's Tailwind build does not scan — so utility
 * classes like `rounded-full` / `h-16` would never be generated. Inline
 * `CSSProperties` are self-contained and work in any theme regardless of its
 * CSS setup. The shapes are pure CSS (border-radius / clip-path) applied to a
 * plain `<img>`, so animated **GIF logos keep playing** under every shape.
 */

import type { CSSProperties } from "react";

export type LogoShape = "none" | "square" | "rounded" | "circle" | "triangle";
export type LogoSize = "small" | "medium" | "large";

/** Bilingual options for the `logo_shape` global setting (schema authoring). */
export const LOGO_SHAPE_OPTIONS = [
  { value: "none", label: "Original", label_ar: "الأصلي" },
  { value: "square", label: "Square", label_ar: "مربع" },
  { value: "rounded", label: "Rounded square", label_ar: "مربع بزوايا دائرية" },
  { value: "circle", label: "Circle", label_ar: "دائرة" },
  { value: "triangle", label: "Triangle", label_ar: "مثلث" },
] as const;

/** Bilingual options for the `logo_size` global setting (schema authoring). */
export const LOGO_SIZE_OPTIONS = [
  { value: "small", label: "Small", label_ar: "صغير" },
  { value: "medium", label: "Medium", label_ar: "متوسط" },
  { value: "large", label: "Large", label_ar: "كبير" },
] as const;

// Box edge length (px) for a shaped logo. Circle/rounded only reveal the
// inscribed area, so they read smaller than a square/triangle at the same box —
// they get a larger frame to stay legible.
const SHAPED_PX: Record<LogoSize, { plain: number; rounded: number }> = {
  small: { plain: 32, rounded: 48 },
  medium: { plain: 40, rounded: 64 },
  large: { plain: 56, rounded: 80 },
};

function normalizeSize(size: string | undefined): LogoSize {
  return size === "large" || size === "medium" ? size : "small";
}

/**
 * Inline style for a logo `<img>` given the merchant's shape + size.
 *
 * Returns `undefined` for `none` (and unknown shapes) so the theme keeps its
 * own native logo sizing untouched — only an explicitly chosen shape overrides
 * it. A shaped logo gets a fixed square box with `object-fit: cover` plus the
 * shape (border-radius for square/rounded/circle, clip-path for triangle).
 */
export function logoImgStyle(
  shape: string | undefined,
  size: string | undefined,
): CSSProperties | undefined {
  if (!shape || shape === "none") return undefined;

  const s = normalizeSize(size);
  const isRound = shape === "circle" || shape === "rounded";
  const px = isRound ? SHAPED_PX[s].rounded : SHAPED_PX[s].plain;
  const base: CSSProperties = {
    height: px,
    width: px,
    objectFit: "cover",
    flex: "0 0 auto",
  };

  switch (shape) {
    case "circle":
      return { ...base, borderRadius: "9999px" };
    case "rounded":
      return { ...base, borderRadius: "0.5rem" };
    case "triangle":
      return { ...base, clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" };
    case "square":
    default:
      return base;
  }
}

/**
 * Derived CSS-custom-property tokens for the chosen logo shape/size. Emitted by
 * `computeGlobalStyleTokens` so host-rendered surfaces (e.g. the checkout
 * header) can match the storefront logo. Returns `{}` for `none`.
 */
export function logoStyleTokens(
  shape: string | undefined,
  size: string | undefined,
): Record<string, string> {
  const style = logoImgStyle(shape, size);
  if (!style) return {};
  const box = `${style.height as number}px`;
  return {
    "--theme-logo-box": box,
    "--theme-logo-radius":
      typeof style.borderRadius === "string" ? style.borderRadius : "0",
    "--theme-logo-clip":
      typeof style.clipPath === "string" ? style.clipPath : "none",
  };
}
