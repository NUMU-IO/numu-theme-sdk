"use client";

import type { CSSProperties, ReactNode } from "react";
import { useThemeSettings } from "../hooks/useThemeSettings";
import { useShop } from "../hooks/useShop";
import { logoImgStyle } from "../utils/logoStyle";

export interface LogoProps {
  /** Explicit logo URL; falls back to global_settings.logo_url then shop.logo_url. */
  src?: string | null;
  /** Alt text; falls back to the brand name / shop name. */
  alt?: string;
  /** Overrides `global_settings.logo_shape` (none/square/rounded/circle/triangle). */
  shape?: string;
  /** Overrides `global_settings.logo_size` (small/medium/large). */
  size?: string;
  className?: string;
  style?: CSSProperties;
  /** Rendered when there is no logo URL (e.g. brand-name text). */
  fallback?: ReactNode;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const NONE_HEIGHT: Record<string, number> = { small: 28, medium: 36, large: 48 };

/**
 * Engine-level store logo. Reads `logo_url`, `logo_shape`, and `logo_size` from
 * the theme's global settings (overridable via props), and renders a plain
 * `<img>` with the chosen shape/size applied via inline styles — so it works in
 * any theme regardless of its CSS setup and keeps **animated GIF logos playing**
 * under every shape. Renders `fallback` (or nothing) when no logo is set.
 */
export function Logo({
  src,
  alt,
  shape,
  size,
  className,
  style,
  fallback,
}: LogoProps) {
  const settings = useThemeSettings();
  const shop = useShop();
  const g = (settings?.global_settings ?? {}) as Record<string, unknown>;

  const url = str(src) || str(g.logo_url) || shop?.logo_url || "";
  const resolvedShape = shape || str(g.logo_shape) || "none";
  const resolvedSize = size || str(g.logo_size) || "small";
  const altText = alt || str(g.brand_name) || shop?.name || "";

  if (!url) return <>{fallback ?? null}</>;

  const shaped = resolvedShape !== "none";
  const imgStyle: CSSProperties = shaped
    ? { ...logoImgStyle(resolvedShape, resolvedSize), ...style }
    : {
        height: NONE_HEIGHT[resolvedSize] ?? NONE_HEIGHT.small,
        width: "auto",
        objectFit: "contain",
        ...style,
      };

  return (
    <img
      src={url}
      alt={altText}
      className={className}
      style={imgStyle}
      loading="eager"
    />
  );
}
