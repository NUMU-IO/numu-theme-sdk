"use client";

/**
 * <EditableText> / <EditableImage> — V3 SDK editor-affordance markers.
 *
 * These are the "I want to edit this" hooks for V3 themes. They render
 * a normal element (span / img) on live storefronts, but inside the
 * customizer iframe they:
 *
 *   1. Stamp a `data-numu-editable` attribute so the storefront's
 *      PreviewBridge can scope click-to-select to specific fields
 *      (rather than the whole section).
 *   2. Show a subtle hover affordance (dotted underline / ring) so the
 *      merchant discovers what's editable inline.
 *   3. Bubble up a `numu:editor:select-field` postMessage on click,
 *      so the dashboard can scroll the matching setting input into
 *      view + focus it.
 *
 * Editor mode is detected the same way PreviewBridge does — query
 * params `editor=v3` OR `preview=true`. Outside the editor, these are
 * pass-through `<span>` / `<img>` with no extra cost.
 *
 * Usage in a V3 section:
 *
 *   import { EditableText, EditableImage } from "@numueg/theme-sdk";
 *
 *   export default function Hero({ instance }: SectionProps) {
 *     const { settings } = instance;
 *     return (
 *       <>
 *         <EditableText
 *           settingId="headline"
 *           sectionId={instance.id}
 *           value={settings.headline}
 *           as="h1"
 *           className="text-4xl"
 *         />
 *         <EditableImage
 *           settingId="hero_image"
 *           sectionId={instance.id}
 *           src={settings.hero_image}
 *           alt={settings.image_alt}
 *         />
 *       </>
 *     );
 *   }
 *
 * Why two components instead of one polymorphic `<Editable>`? Text and
 * image have different click semantics (text → focus the matching
 * setting; image → open the media picker) and different DOM shapes,
 * and we want the JSX to read naturally. Future field types (link,
 * color picker, video) get their own component pair.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ElementType,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";

// ─── Editor-mode detection ──────────────────────────────────────────────────

/**
 * The detection runs lazily (after mount) to keep SSR HTML identical
 * to the first client paint. If we read window.location during render,
 * we'd return false on the server and true on the client → hydration
 * mismatch. By gating on a useEffect-set state, the initial paint
 * never adds editor-only attributes, and they appear on the second
 * paint (one tick later, after the bridge is awake anyway).
 */
function useIsEditor(): boolean {
  const [isEditor, setIsEditor] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const flag =
        params.get("editor") === "v3" || params.get("preview") === "true";
      // The iframe-only check: the merchant's customizer renders this
      // bundle inside an iframe. On a "plain" preview tab (no parent
      // window), we keep the editor-mode markers off — they'd be
      // useless to a merchant browsing their own storefront in a
      // separate tab.
      const inFrame = window.parent !== window;
      setIsEditor(flag && inFrame);
    } catch {
      // No-op — SSR / sandboxed environments fall through to false.
    }
  }, []);
  return isEditor;
}

/**
 * Post a "this field was clicked" event to the dashboard so the editor
 * can scroll the matching setting input into view + focus it.
 *
 * Origin is `*` because the parent's origin varies (dev / staging /
 * prod / different merchant subdomains). The dashboard side enforces
 * origin matching for INBOUND messages from the iframe, so an
 * attacker can't spoof a select-field event by hijacking
 * postMessage — the dashboard's origin gate drops anything not from
 * the storefront's exact origin.
 */
function postFieldSelected(
  sectionId: string,
  settingId: string,
  blockId?: string | null,
): void {
  if (typeof window === "undefined") return;
  if (window.parent === window) return;
  try {
    window.parent.postMessage(
      {
        type: "numu:editor:select-field",
        payload: {
          sectionId,
          blockId: blockId ?? null,
          settingId,
        },
      },
      "*",
    );
  } catch {
    /* parent gone / sandboxed strictly — no-op */
  }
}

// ─── EditableText ───────────────────────────────────────────────────────────

export interface EditableTextProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** The section instance id (key inside templates.<page>.sections). */
  sectionId: string;
  /** Optional block id when the field lives inside a section block. */
  blockId?: string | null;
  /** The setting key from the section's schema (e.g. "headline"). */
  settingId: string;
  /** The current text value (may be HTML for inline_richtext settings). */
  value: string | undefined | null;
  /**
   * Element to render. Defaults to `<span>` so the component is
   * inline-compatible. Pass "h1" / "h2" / "p" / "div" for block-level
   * usage.
   */
  as?: ElementType;
  /**
   * Set to true to render the value as HTML (for inline_richtext
   * settings whose stored form is `<b>Welcome</b>`). Defaults to false
   * — plain-text fields are rendered as a text node.
   */
  html?: boolean;
  /** Empty-state placeholder shown when value is "" / null. */
  placeholder?: ReactNode;
}

export const EditableText = forwardRef<HTMLElement, EditableTextProps>(
  function EditableText(
    {
      sectionId,
      blockId,
      settingId,
      value,
      as: Component = "span",
      html = false,
      placeholder,
      className,
      onClick,
      style,
      ...rest
    },
    ref,
  ) {
    const isEditor = useIsEditor();

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLElement>) => {
        // Forward the click first so themes that wired their own
        // handler keep working.
        onClick?.(e);
        if (!isEditor) return;
        // The whole point: route the click to the matching setting
        // input. Stop propagation only when the editor is open so we
        // don't double-fire the section-level click-to-select handler
        // that PreviewBridge installs at the document level. Themes
        // can still receive the click via their own onClick prop
        // (already invoked above).
        e.stopPropagation();
        postFieldSelected(sectionId, settingId, blockId);
      },
      [isEditor, onClick, sectionId, settingId, blockId],
    );

    const editorAttrs = useMemo(
      () =>
        isEditor
          ? {
              "data-numu-editable": "text",
              "data-numu-section-id": sectionId,
              "data-numu-setting-id": settingId,
              "data-numu-block-id": blockId ?? undefined,
              role: "button" as const,
              tabIndex: 0,
            }
          : {},
      [isEditor, sectionId, settingId, blockId],
    );

    const effectiveStyle = isEditor
      ? {
          ...style,
          cursor: "text" as const,
          // Subtle dotted underline so the merchant discovers what's
          // editable. The dashed style + inherited color keeps the
          // affordance from clashing with the theme's typography.
          textDecoration: "underline dotted rgba(99, 102, 241, 0.7)",
          textUnderlineOffset: "4px",
        }
      : style;

    const isEmpty = value == null || value === "";
    const display = isEmpty && placeholder !== undefined ? placeholder : value ?? "";

    if (html && typeof display === "string") {
      return (
        <Component
          ref={ref}
          className={className}
          style={effectiveStyle}
          onClick={handleClick}
          dangerouslySetInnerHTML={{ __html: display }}
          {...editorAttrs}
          {...rest}
        />
      );
    }
    return (
      <Component
        ref={ref}
        className={className}
        style={effectiveStyle}
        onClick={handleClick}
        {...editorAttrs}
        {...rest}
      >
        {display}
      </Component>
    );
  },
);

// ─── EditableImage ──────────────────────────────────────────────────────────

export interface EditableImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  sectionId: string;
  blockId?: string | null;
  settingId: string;
  /** Image src — may be empty/undefined if the merchant hasn't picked one yet. */
  src: string | undefined | null;
  /** Placeholder src shown when `src` is empty. Defaults to a 1x1 transparent gif. */
  emptyPlaceholderSrc?: string;
}

const EMPTY_GIF =
  "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

export const EditableImage = forwardRef<HTMLImageElement, EditableImageProps>(
  function EditableImage(
    {
      sectionId,
      blockId,
      settingId,
      src,
      alt,
      emptyPlaceholderSrc,
      className,
      onClick,
      style,
      ...rest
    },
    ref,
  ) {
    const isEditor = useIsEditor();
    const isEmpty = !src;

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLImageElement>) => {
        onClick?.(e);
        if (!isEditor) return;
        e.stopPropagation();
        postFieldSelected(sectionId, settingId, blockId);
      },
      [isEditor, onClick, sectionId, settingId, blockId],
    );

    const editorAttrs = useMemo(
      () =>
        isEditor
          ? {
              "data-numu-editable": "image",
              "data-numu-section-id": sectionId,
              "data-numu-setting-id": settingId,
              "data-numu-block-id": blockId ?? undefined,
              role: "button" as const,
              tabIndex: 0,
            }
          : {},
      [isEditor, sectionId, settingId, blockId],
    );

    const effectiveStyle = isEditor
      ? {
          ...style,
          cursor: "pointer" as const,
          outline: isEmpty
            ? "2px dashed rgba(99, 102, 241, 0.6)"
            : "2px dashed transparent",
          outlineOffset: "-2px",
        }
      : style;

    const effectiveSrc = src || emptyPlaceholderSrc || EMPTY_GIF;
    const effectiveAlt = alt ?? "";

    return (
      <img
        ref={ref}
        src={effectiveSrc}
        alt={effectiveAlt}
        className={className}
        style={effectiveStyle}
        onClick={handleClick}
        {...editorAttrs}
        {...rest}
      />
    );
  },
);
