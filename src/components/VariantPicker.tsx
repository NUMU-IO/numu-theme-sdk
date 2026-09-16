"use client";

/**
 * VariantPicker — the single renderer for a product's option axes.
 *
 * ## Why the theme's markup is a CHILD, not a sibling
 *
 * The obvious design is: the theme renders its own swatches, then hides them
 * when it discovers the swatch app is installed. That cannot work. Install
 * state arrives client-side after hydration, so the sequence on every product
 * page is: SSR emits the theme's row -> hydration adds the app's row -> one of
 * them disappears. A visible double render and a layout shift on every PDP and
 * every grid card, on a mobile-first market, times nineteen independent
 * implementations of the same race. Worse, it fails OPEN into a doubled row,
 * which is the single most-reported failure of the Shopify swatch-app category.
 *
 * So there is exactly ONE component that decides what occupies that space. The
 * theme's existing markup is passed to it as `children` and rendered only when
 * this component has nothing better to show. A doubled row becomes impossible
 * by construction rather than by a runtime check, and uninstalling is a no-op:
 * the children render again, no dead node, no blank gap, no residue.
 *
 * ## When the children render
 *
 * When the product carries no swatch decoration on any axis. Colour hexes,
 * per-value images and Arabic labels live on `product.attributes` and are
 * merged onto `options[]` by the API. A product with none of that has nothing
 * this component can draw that the theme cannot, so the theme keeps its own
 * markup and its own design.
 *
 * `settings` is the store's app configuration when the Variant Swatches app is
 * installed. It is optional on purpose: the component works from product data
 * alone, and app settings only adjust presentation on top.
 *
 * ## Accessibility and RTL are correctness here, not polish
 *
 * - The value label ALWAYS renders next to the axis name. Two themes currently
 *   ship colour swatches with no text at all, so a merchant with an Arabic
 *   colour name ships a row of blank unlabelled circles — a WCAG 1.4.1
 *   colour-only-meaning failure. This component must not inherit that.
 * - Selected state is never colour alone: ring + offset, plus a check on image
 *   tiles. A coloured ring around a white chip is invisible.
 * - Logical CSS properties only. Digits are wrapped in `<bdi dir="ltr">` so a
 *   counter stays LTR inside an Arabic row.
 * - A 44x44 minimum tap target regardless of the visual chip size — a small
 *   chip gets padding, not a smaller hit area.
 * - `data-value` carries the CANONICAL untranslated value, so translation can
 *   never break variant matching or the E2E hooks.
 */

import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";

import type { Product, ProductOption } from "../types/entities";
import { valueStates, type ValueState } from "../utils/variants";
import { isColorAxisName, isHex, lexiconHex, normalizeColorKey } from "../utils/colorLexicon";
import { responsiveImg } from "../sections/_shared";

/** How a sold-out value is treated. Four modes, because this is the most
 *  configured setting in the whole swatch-app category. */
export type OutOfStockMode = "strike" | "dim" | "cross" | "hide";

/** Store-wide presentation, from the app installation's settings blob. */
export interface VariantSwatchSettings {
  /** Comma-separated axis names to treat as colour axes. */
  color_option_names?: string | string[];
  /**
   * What a value with BOTH an image and a hex shows.
   *
   * `custom` (default) prefers the image — the merchant picked it explicitly,
   * and a photo carries more than a flat chip. `color_only` ignores images and
   * paints the hex, which is the lever for a catalogue whose per-value photos
   * read badly at 24px. Both live rabbit products carry both, so this is not a
   * hypothetical.
   *
   * The plan's `variant_first` / `variant_last` are deliberately absent:
   * `variants[].image_url` is null on 100% of the option-bearing products on
   * both live stores, so they would be two settings that resolve to nothing.
   */
  image_source?: "custom" | "color_only";
  /**
   * Which control the shopper sees. One component, because the alternative is
   * every theme hand-rolling its own and drifting — which is the state this
   * replaced.
   *
   *   `chip`     colour/image tile only (default)
   *   `pills`    small round tile + label inside one outlined pill
   *   `box`      bordered card: tile, label, optional price
   *   `polaroid` box with the tile framed, label and price beneath
   *   `button`   text only, rectangular
   *   `radio`    radio dot + label, optional price
   *   `dropdown` a native <select> — the compact fallback for a long axis
   */
  swatch_style?: "chip" | "pills" | "box" | "polaroid" | "button" | "radio" | "dropdown";
  /** Show each value's price. Resolved from the variant rows, never guessed. */
  show_price?: boolean;
  swatch_shape?: "circle" | "square" | "rounded" | "pill" | "custom";
  /**
   * Corner radius when `swatch_shape` is `custom` — any CSS length or
   * percentage (`"4px"`, `"14px"`, `"30%"`). The named shapes cover what most
   * merchants want; this is the escape hatch for the ones who want their own.
   */
  swatch_radius?: string;
  /**
   * Tile aspect, `width:height`. `1:1` is the square/circle default; a taller
   * ratio is what a catalogue of shoes, bags or garments actually needs, and
   * is how the commercial swatch apps present a product photo per value.
   * Accepts `"1:1"`, `"4:3"`, `"3:4"`, `"16:9"`, `"9:16"` or any `w:h`.
   */
  swatch_ratio?: string;
  swatch_size?: "s" | "m" | "l";
  out_of_stock?: OutOfStockMode;
  show_on_cards?: boolean;
  card_max_visible?: number;
  /** Explicit `option value -> hex`, tier 1 of the colour ladder. */
  color_overrides?: Record<string, string>;
}

export interface VariantPickerProps {
  product: Pick<Product, "options" | "variants"> & Partial<Pick<Product, "in_stock" | "attributes">>;
  /** Current axis -> value selection, from `useVariantSelection`. */
  selection: Record<string, string>;
  /** Called when a shopper picks a value. Omit to render display-only. */
  onSelect?: (axis: string, value: string) => void;
  /** App settings when the swatch app is installed. */
  settings?: VariantSwatchSettings | null;
  /** `"ar"` renders `values_ar` / `name_ar` labels. */
  locale?: string;
  /** `card` is the compact, non-interactive collection-card variant. */
  surface?: "pdp" | "card";
  /** Cap the values shown, with a `+N` counter. */
  maxVisible?: number;
  className?: string;
  /** The theme's own markup — rendered when there is no decoration to draw. */
  children?: ReactNode;
}

/** Visual chip size in CSS px, before the tap-target floor. */
const SIZES = { s: 28, m: 40, l: 48 } as const;
const CARD_SIZES = { s: 20, m: 24, l: 32 } as const;
const MIN_TAP = 44;

const RADII: Record<string, string> = {
  circle: "50%",
  square: "0",
  rounded: "8px",
  pill: "999px",
};

/**
 * Parse a `w:h` ratio into a height multiplier.
 *
 * Returns 1 for anything unusable rather than throwing or collapsing the tile:
 * a merchant typo must not blank a product page. A circle is forced square
 * because a "circle" at 3:4 is an ellipse, which is not what anyone picking
 * "circle" asked for.
 */
function ratioScale(ratio: string | undefined, shape: string): number {
  if (!ratio || shape === "circle") return 1;
  const m = /^\s*(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)\s*$/.exec(ratio);
  if (!m) return 1;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!(w > 0) || !(h > 0)) return 1;
  // Clamp: past these the tile stops reading as a swatch and starts breaking
  // the row it sits in.
  return Math.min(3, Math.max(0.33, h / w));
}

/** One value, resolved down the colour ladder. */
interface ResolvedValue {
  /** Canonical, untranslated — the cart and the E2E hooks key on this. */
  value: string;
  /** What the shopper reads. */
  label: string;
  hex?: string;
  image?: string;
  state: ValueState;
  /** Cheapest variant price carrying this value, or null when none does. */
  price?: number | null;
}

/** Positional read that tolerates a short or absent decoration array. */
function at(list: (string | null)[] | undefined, i: number): string | undefined {
  const v = list?.[i];
  return typeof v === "string" && v.trim() ? v : undefined;
}

/**
 * Resolve one axis's values down the ladder.
 *
 * Tier 1 explicit mapping, tier 2 lexicon, tier 3 the value's image, tier 4 a
 * text pill. Never a grey chip.
 */
function resolveAxis(
  axis: ProductOption,
  states: Record<string, ValueState>,
  opts: {
    isColor: boolean;
    locale?: string;
    overrides?: Record<string, string>;
    colorOnly?: boolean;
  },
): ResolvedValue[] {
  const arabic = (opts.locale || "").toLowerCase().startsWith("ar");
  return (axis.values || []).map((value, i) => {
    const explicit = at(axis.hex_values, i);
    const override = opts.overrides?.[normalizeColorKey(value)];
    const hex = opts.isColor
      ? [override, explicit].find(isHex) || lexiconHex(value)
      : undefined;
    return {
      value,
      label: (arabic ? at(axis.values_ar, i) : undefined) || value,
      hex,
      image: opts.colorOnly ? undefined : at(axis.image_values, i),
      state: states[value] ?? "buyable",
    };
  });
}

/** Does this axis carry anything this component can draw? */
function axisHasDecoration(axis: ProductOption): boolean {
  return Boolean(
    axis.hex_values?.some(Boolean) ||
      axis.image_values?.some(Boolean) ||
      axis.values_ar?.some(Boolean),
  );
}

function chipStyle(
  v: ResolvedValue,
  px: number,
  radius: string,
  selected: boolean,
  blockPx?: number,
  fade?: number,
): CSSProperties {
  const style: CSSProperties = {
    // REQUIRED. A <span> is display:inline by default, and an inline box
    // ignores inline-size/block-size entirely — the chip rendered 0x0 on a real
    // page while every unit test passed, because the test DOM does no layout.
    // Found in browser QA; do not remove.
    display: "inline-block",
    inlineSize: px,
    blockSize: blockPx ?? px,
    borderRadius: radius,
    // Never colour alone: a ring plus an offset gap, so the selected state
    // survives a white chip on a light theme and a dark chip on a dark one.
    boxShadow: selected
      ? "0 0 0 2px var(--numu-swatch-ring, currentColor), inset 0 0 0 2px var(--numu-swatch-ring-inset, #fff)"
      : "inset 0 0 0 1px var(--numu-swatch-border, rgba(0,0,0,.18))",
  };
  if (v.image) {
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  } else if (v.hex) {
    style.background = v.hex;
  } else {
    // Explicit unknown: a checkerboard, never an invisible or grey dot. A grey
    // chip reads to a shopper as "this colour is grey", which is a wrong
    // answer rather than a missing one.
    style.background =
      "repeating-conic-gradient(var(--numu-swatch-unknown, #d8d8d8) 0% 25%, transparent 0% 50%) 50% / 8px 8px";
  }
  // The fade belongs to the SURFACE, never to a box that also holds the label
  // or the diagonal: stacking opacity on a container and again on the tile
  // inside it multiplied out to 0.20 on the `box` and `polaroid` styles, which
  // is a swatch nobody can read.
  if (fade != null) style.opacity = fade;
  return style;
}

/**
 * The price a click on this value would land on.
 *
 * The cheapest variant carrying the value alongside the other axes as currently
 * picked; when that exact combination does not exist, any variant carrying it.
 * Returns null when no variant does, so the caller renders nothing rather than
 * a zero — a `0.00` under a swatch reads as "free", which is worse than silent.
 */
function priceForValue(
  product: VariantPickerProps["product"],
  axis: string,
  value: string,
  selection: Record<string, string>,
): number | null {
  const variants = product.variants || [];
  const carrying = variants.filter((v) => {
    const ov = v.option_values || v.options || {};
    return ov[axis] === value;
  });
  if (carrying.length === 0) return null;
  const others = Object.entries(selection).filter(([k]) => k !== axis);
  const exact = carrying.filter((v) => {
    const ov = v.option_values || v.options || {};
    return others.every(([k, picked]) => ov[k] === picked);
  });
  const pool = exact.length > 0 ? exact : carrying;
  const prices = pool
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

/** Money for a swatch label. Digits stay LTR inside an Arabic row. */
function priceLabel(amount: number, currency: string | undefined, locale?: string): string {
  try {
    return new Intl.NumberFormat(
      (locale || "en").toLowerCase().startsWith("ar") ? "ar-EG" : "en-US",
      { style: "currency", currency: currency || "EGP", maximumFractionDigits: 2 },
    ).format(amount);
  } catch {
    return `${amount} ${currency || ""}`.trim();
  }
}

/**
 * How far a sold-out option fades.
 *
 * Under `dim` the fade is the ONLY signal, so it has to be unmistakable. Under
 * `strike` and `cross` the line carries the signal, so the surface stays light
 * enough that the shopper can still tell which colour they are missing — a
 * swatch faded to nothing answers "sold out" but not "sold out of what".
 */
const MARK_FADE: Record<string, number> = { dim: 0.35, strike: 0.55, cross: 0.55 };

/**
 * The sold-out diagonal.
 *
 * A halo stroke under a hairline, the pair every legible map label uses: the
 * pale line keeps the mark visible on a black swatch, the dark line keeps it
 * from shouting on a white one. Neither is a theme decision, so both are
 * `--numu-swatch-strike*` variables a theme can repaint.
 *
 * Written as `stroke` in a style object rather than as an SVG presentation
 * attribute, because `var()` resolves in a CSS declaration and not in an
 * attribute value.
 */
const STRIKE_HALO: CSSProperties = {
  stroke: "var(--numu-swatch-strike-halo, rgba(255,255,255,.9))",
  strokeWidth: 3,
  strokeLinecap: "round",
};
const STRIKE_INK: CSSProperties = {
  stroke: "var(--numu-swatch-strike, rgba(17,24,39,.62))",
  strokeWidth: 1.25,
  strokeLinecap: "round",
};

/**
 * The line across a sold-out swatch.
 *
 * SVG, not a background gradient. `preserveAspectRatio="none"` puts the line on
 * the true corner-to-corner diagonal at ANY tile ratio, and
 * `vector-effect="non-scaling-stroke"` holds it to a hairline at any size — a
 * gradient band is measured perpendicular to the box, so it thickened into a
 * wedge on a tall tile and drew a heavy black X that read as "error" rather
 * than "sold out". The wrapper clips to the swatch's own radius, so a circle
 * gets a clean chord instead of a line poking out past its edge.
 *
 * `data-numu-strike` is the QA hook: the line is CSS this component's test DOM
 * does not compute, so a test asserts on the hook and the browser proves the
 * pixels.
 */
function Strike({ radius, cross }: { radius: string | number; cross: boolean }): ReactNode {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        focusable="false"
        style={{ display: "block", inlineSize: "100%", blockSize: "100%" }}
      >
        <g data-numu-strike="1">
          <line x1="0" y1="100" x2="100" y2="0" vectorEffect="non-scaling-stroke" style={STRIKE_HALO} />
          <line x1="0" y1="100" x2="100" y2="0" vectorEffect="non-scaling-stroke" style={STRIKE_INK} />
        </g>
        {/* A cross is BOTH diagonals. One mirrored diagonal is only a strike
            leaning the other way. */}
        {cross ? (
          <g data-numu-strike="2">
            <line x1="0" y1="0" x2="100" y2="100" vectorEffect="non-scaling-stroke" style={STRIKE_HALO} />
            <line x1="0" y1="0" x2="100" y2="100" vectorEffect="non-scaling-stroke" style={STRIKE_INK} />
          </g>
        ) : null}
      </svg>
    </span>
  );
}

export function VariantPicker({
  product,
  selection,
  onSelect,
  settings,
  locale,
  surface = "pdp",
  maxVisible,
  className,
  children,
}: VariantPickerProps): ReactNode {
  const axes = useMemo(() => product.options || [], [product.options]);
  const states = useMemo(() => valueStates(product, selection), [product, selection]);

  const decorated = useMemo(() => axes.some(axisHasDecoration), [axes]);

  const sizeKey = settings?.swatch_size || "m";
  const px = Math.max(
    surface === "card" ? CARD_SIZES[sizeKey] : SIZES[sizeKey],
    1,
  );
  const shape = settings?.swatch_shape || "circle";
  // `custom` takes the merchant's own radius; an empty one falls back to
  // `rounded` rather than to a square nobody chose.
  const radius =
    shape === "custom"
      ? settings?.swatch_radius?.trim() || RADII.rounded
      : RADII[shape] ?? RADII.circle;
  const ratio = ratioScale(settings?.swatch_ratio, shape);
  const mode: OutOfStockMode = settings?.out_of_stock || "strike";
  // A card shows a SWATCH ROW, so it always uses the compact tile. The
  // labelled layouts (box, polaroid, pills, radio, button) are product-page
  // layouts: dropped into a grid cell they put a label and a price under every
  // value, which made that one card ~180px taller than its neighbours and
  // broke the grid. Same reason the per-value price is a product-page thing.
  const style = surface === "card" ? "chip" : settings?.swatch_style || "chip";
  const showPrice = surface === "card" ? false : Boolean(settings?.show_price);
  // Currency comes off a variant row, never guessed: a price in the wrong
  // currency is worse than no price at all.
  const currency = (product.variants || []).find((v) => v.price_currency)
    ?.price_currency;
  const cap =
    maxVisible ?? (surface === "card" ? (settings?.card_max_visible ?? 5) : undefined);
  const interactive = Boolean(onSelect) && surface !== "card";
  const arabic = (locale || "").toLowerCase().startsWith("ar");

  // Nothing to draw that the theme cannot draw better in its own design.
  if (!decorated || axes.length === 0) return <>{children}</>;
  // The merchant turned card swatches off. Without this the setting rendered
  // in the hub, saved, and changed nothing — a dead control is worse than an
  // absent one, because it reads as a broken feature.
  if (surface === "card" && settings?.show_on_cards === false) return <>{children}</>;

  return (
    <div className={className} data-numu-variant-picker={surface}>
      {axes.map((axis) => {
        // A CARD shows swatches, not a full option picker. Rendering every axis
        // there put a size row with its own heading on every card, which made
        // the card taller than its neighbours and broke the grid — and a
        // shopper cannot pick a size from a card anyway, because a card has no
        // resolved variant. Text-only axes are skipped; the PDP still shows
        // all of them.
        // VISUAL decoration specifically — Arabic labels alone make an axis
        // "decorated" for the fallback decision, but a card needs a tile.
        const axisHasTile = Boolean(
          axis.hex_values?.some(Boolean) || axis.image_values?.some(Boolean),
        );
        if (surface === "card" && !axisHasTile) return null;
        const isColor = isColorAxisName(axis.name, settings?.color_option_names);
        const resolved = resolveAxis(axis, states[axis.name] || {}, {
          isColor,
          locale,
          overrides: settings?.color_overrides,
          colorOnly: settings?.image_source === "color_only",
        }).map((v) =>
          showPrice
            ? { ...v, price: priceForValue(product, axis.name, v.value, selection) }
            : v,
        );
        // Does ANY value on this axis resolve to something visual? If yes the
        // row is chips, and a value that resolved to nothing gets the explicit
        // unknown chip so the row stays uniform. If NO value resolves, the axis
        // is text — the last rung of the ladder — rather than a row of
        // identical checkerboards saying nothing.
        const axisHasVisual = resolved.some((v) => v.hex || v.image);
        const shown = resolved.filter((v) => !(mode === "hide" && v.state !== "buyable"));
        const visible = cap ? shown.slice(0, cap) : shown;
        const hidden = shown.length - visible.length;
        const chosen = selection[axis.name];
        const chosenLabel = resolved.find((v) => v.value === chosen)?.label;
        const axisLabel = (arabic ? axis.name_ar : undefined) || axis.name;

        return (
          <div
            key={axis.name}
            data-numu-axis={axis.name}
            style={{ marginBlockEnd: surface === "card" ? 6 : 16 }}
          >
            {/* The label always renders on a PDP. It doubles as the accessible
                name and is the mobile-correct answer, since hover does not
                exist. A card omits it — there is no room, the row sits under
                the product title, and every chip still carries an aria-label,
                so nothing is lost to assistive tech. */}
            {surface === "card" ? null : (
              <p style={{ marginBlockEnd: 8, fontSize: 13 }}>
                <span style={{ opacity: 0.7 }}>{axisLabel}</span>
                {chosenLabel ? <span>{`: ${chosenLabel}`}</span> : null}
              </p>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {visible.map((v) => {
                const selected = v.value === chosen;
                const unavailable = v.state !== "buyable";
                // Does this row show a visual tile at all? An axis where
                // nothing resolved is TEXT whatever style is configured — a row
                // of identical checkerboards says nothing. Note this is not
                // gated on `isColor`: an image swatch on a non-colour axis
                // ("Style: Platform / Low") is part of the feature set.
                const hasTile = axisHasVisual;
                const img = v.image
                  ? responsiveImg(v.image, { widths: [64], sizes: `${px}px` })
                  : null;

                const common = {
                  "data-testid": "storefront-product-detail-variant-option",
                  "data-value": v.value,
                  "data-sold-out": unavailable ? "true" : undefined,
                  "data-state": v.state,
                  "aria-label": `${axisLabel}: ${v.label}`,
                  "aria-pressed": interactive ? selected : undefined,
                  "aria-disabled": unavailable || undefined,
                  title: v.label,
                } as const;

                const tap: CSSProperties = {
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  // The chip stays its visual size; the HIT AREA gets the floor.
                  minInlineSize: surface === "card" ? undefined : MIN_TAP,
                  minBlockSize: surface === "card" ? undefined : MIN_TAP,
                  padding: 0,
                  border: 0,
                  background: "none",
                  cursor: interactive && !unavailable ? "pointer" : "default",
                  lineHeight: 1,
                };

                // The visual tile: colour, image, or the explicit unknown
                // checkerboard. Shared by every style that shows one.
                const tile = (size: number) => (
                  // `lineHeight: 0` is load-bearing. Without it the wrapper
                  // keeps the inline strut under the chip, so the box measured
                  // 40x43 while the swatch was 40x40 — and the diagonal, which
                  // is clipped to THIS box, ran corner to corner of the taller
                  // rectangle and poked out past the circle.
                  <span style={{ position: "relative", display: "inline-block", lineHeight: 0 }}>
                    {/* A background image rather than an <img>: the tile is a
                        fixed box and `cover` framing is the whole job. The
                        width is pinned to 64, the smallest rung of the closed
                        width ladder - an off-ladder width is an HTTP 400. */}
                    <span
                      style={{
                        ...chipStyle(
                          v,
                          size,
                          radius,
                          selected && style === "chip",
                          Math.round(size * ratio),
                          fade,
                        ),
                        ...(img ? { backgroundImage: `url(${img.src})` } : null),
                      }}
                    />
                    {marked ? <Strike radius={radius} cross={mode === "cross"} /> : null}
                    {/* No check glyph on a selected image tile. It anchored to
                        the wrapper's CORNER, which on a circular swatch is
                        outside the visible disc, so it rendered clipped and
                        unreadable over the photo. Selection is already carried
                        without colour by the 2px ring and its inset gap, and
                        spelled out in words by the axis heading above the row
                        ("Colour: Red"), so the glyph was a third signal that
                        only cost legibility. */}
                  </span>
                );

                const priceNode =
                  showPrice && v.price != null ? (
                    <span
                      style={{
                        fontSize: 11,
                        opacity: 0.7,
                        display: "block",
                        marginBlockStart: 2,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {/* Money is digits: it stays LTR inside an Arabic row. */}
                      <bdi dir="ltr">{priceLabel(v.price, currency, locale)}</bdi>
                    </span>
                  ) : null;

                // One sold-out vocabulary, decided once: a fade on the
                // surface, plus a diagonal across whichever box the shopper is
                // actually looking at. That box is the tile when the value has
                // one and the pill itself when it does not, which is how a
                // sold-out size reads in the swatch apps worth copying — and it
                // beats a line-through drawn through Arabic letterforms.
                const marked = unavailable && (mode === "strike" || mode === "cross");
                const fade = unavailable ? MARK_FADE[mode] : undefined;
                // `radio` is a row, not a box: a diagonal across a full-width
                // row reads as a deleted line rather than a struck swatch, so
                // that one layout keeps the line on the label. Same for any
                // style whose axis resolved no tile to draw on.
                const struck =
                  marked && (style === "radio" || (!hasTile && style !== "button"))
                    ? ("line-through" as const)
                    : undefined;
                // The pill IS the swatch when there is no tile.
                const pillRadius =
                  style === "button" ? 6 : radius === "50%" ? "999px" : radius;
                const ring = selected
                  ? "inset 0 0 0 2px var(--numu-swatch-ring, currentColor)"
                  : "inset 0 0 0 1px var(--numu-swatch-border, rgba(0,0,0,.18))";

                let inner: ReactNode;
                if (style === "pills") {
                  // Tile + label inside one outlined pill.
                  inner = (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        paddingInline: 10,
                        paddingBlock: 6,
                        borderRadius: 999,
                        fontSize: 13,
                        textDecoration: struck,
                        boxShadow: ring,
                      }}
                    >
                      {hasTile ? tile(Math.round(px * 0.7)) : null}
                      <span style={{ opacity: fade }}>{v.label}</span>
                    </span>
                  );
                } else if (style === "box" || style === "polaroid") {
                  // Bordered card: tile above, label (and price) beneath.
                  inner = (
                    <span
                      style={{
                        display: "inline-block",
                        padding: style === "polaroid" ? 8 : 10,
                        borderRadius: 10,
                        textAlign: "center",
                        // Room for the label and price. Without a floor the card
                        // shrinks to the tile and the price wraps mid-number,
                        // which is how it first rendered in the browser.
                        minInlineSize: hasTile ? px + 40 : 72,
                        boxShadow: ring,
                      }}
                    >
                      {hasTile ? tile(style === "polaroid" ? px + 32 : px + 24) : null}
                      <span
                        style={{
                          display: "block",
                          marginBlockStart: hasTile ? 8 : 0,
                          fontSize: 12,
                          lineHeight: 1.3,
                          whiteSpace: "nowrap",
                          textDecoration: struck,
                          opacity: fade,
                        }}
                      >
                        {v.label}
                      </span>
                      {priceNode}
                    </span>
                  );
                } else if (style === "radio") {
                  inner = (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        paddingInline: 12,
                        paddingBlock: 8,
                        borderRadius: 8,
                        fontSize: 13,
                        textDecoration: struck,
                        opacity: fade,
                        boxShadow: ring,
                      }}
                    >
                      {/* A real radio glyph, not a coloured dot: the selected
                          state must never be carried by colour alone. */}
                      <span
                        aria-hidden
                        style={{
                          inlineSize: 14,
                          blockSize: 14,
                          borderRadius: "50%",
                          display: "inline-block",
                          boxShadow: selected
                            ? "inset 0 0 0 4px var(--numu-swatch-ring, currentColor), inset 0 0 0 7px var(--numu-swatch-ring-inset, #fff)"
                            : "inset 0 0 0 1px var(--numu-swatch-border, rgba(0,0,0,.45))",
                        }}
                      />
                      <span style={{ textAlign: "start" }}>
                        <span style={{ display: "block" }}>{v.label}</span>
                        {priceNode}
                      </span>
                    </span>
                  );
                } else if (style === "button" || !hasTile) {
                  // Text only - the deliberate style, and the last rung of the
                  // colour ladder for an axis that resolved nothing visual.
                  inner = (
                    <span
                      style={{
                        position: "relative",
                        display: "inline-block",
                        paddingInline: 12,
                        paddingBlock: 8,
                        borderRadius: pillRadius,
                        fontSize: 13,
                        boxShadow: ring,
                      }}
                    >
                      <span style={{ display: "block", opacity: fade }}>{v.label}</span>
                      {priceNode}
                      {marked ? (
                        <Strike radius={pillRadius} cross={mode === "cross"} />
                      ) : null}
                    </span>
                  );
                } else {
                  inner = tile(px);
                }

                if (!interactive) {
                  return (
                    <span key={v.value} {...common} style={tap}>
                      {inner}
                    </span>
                  );
                }
                return (
                  <button
                    key={v.value}
                    type="button"
                    {...common}
                    style={tap}
                    disabled={v.state === "unreachable"}
                    onClick={() => onSelect?.(axis.name, v.value)}
                  >
                    {inner}
                  </button>
                );
              })}

              {hidden > 0 ? (
                // Contains a digit, so it stays LTR inside an RTL row.
                <span style={{ alignSelf: "center", fontSize: 12, opacity: 0.7 }}>
                  <bdi dir="ltr">{`+${hidden}`}</bdi>
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default VariantPicker;
