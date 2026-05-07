"use client";

import {
  Component,
  type HTMLAttributes,
  type ReactNode,
} from "react";

interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Section instance id (the order key in templates). Required for the
   * customizer's click-to-select to work. */
  id: string;
  /** Section type as registered in the theme registry / schemas. */
  type: string;
  /** Section group id (header / footer / announcement-bar) when this
   * section is mounted inside a group rather than a page template. */
  groupId?: string;
  /** Override the fallback shown when this section throws. Defaults to
   * a small inline error card (visible to the merchant in the customizer,
   * invisible to live shoppers — see CSS comment below). */
  errorFallback?: ReactNode;
  children: ReactNode;
}

// ── Section ErrorBoundary ───────────────────────────────────────────────────
//
// One thrown section used to take down the whole bundle's React tree —
// every other section unmounted along with the bad one, leaving the
// merchant with a blank storefront and no way to find the offender.
//
// We catch render/lifecycle errors at the per-section seam so a bug in
// "Hero v2" doesn't break the perfectly fine "Newsletter" section
// rendered on the same page. The boundary:
//
//   1. Logs the error + section context to console.error so the dev
//      console makes the offender obvious.
//   2. Re-renders a fallback (defaults to a small error card; theme
//      can override via the `errorFallback` prop).
//   3. Posts `numu:editor:section-error` to window.parent so the V3
//      customizer can highlight the offending section in its tree.
//
// The boundary is INSIDE the `<section data-section-id>` wrapper, so
// the data attributes still let the customizer click-select the bad
// section even when its body crashed — merchants can delete it.

interface BoundaryState {
  error: Error | null;
}

interface SectionErrorBoundaryProps {
  sectionId: string;
  sectionType: string;
  fallback: ReactNode;
  children: ReactNode;
}

class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Match the host's <ByotThemeBoundary> log shape so the prefix is
    // recognizable in the iframe console even when both boundaries fire.
    console.error(
      `[Section ${this.props.sectionType}#${this.props.sectionId}] threw:`,
      error,
    );
    if (typeof window !== "undefined" && window.parent !== window) {
      try {
        window.parent.postMessage(
          {
            type: "numu:editor:section-error",
            payload: {
              sectionId: this.props.sectionId,
              sectionType: this.props.sectionType,
              message: error.message,
            },
          },
          "*",
        );
      } catch {
        // Cross-origin postMessage with `*` is permissive enough that
        // this branch is for true edge cases (sandboxed iframe with
        // disallow-script). Nothing useful to do.
      }
    }
  }

  render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}

function defaultSectionFallback(
  sectionType: string,
  sectionId: string,
): ReactNode {
  return (
    <div
      role="alert"
      data-numu-section-error="true"
      style={{
        padding: "1rem",
        border: "1px dashed #f87171",
        background: "#fef2f2",
        color: "#b91c1c",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: "0.875rem",
        lineHeight: 1.5,
        borderRadius: "0.375rem",
        margin: "0.5rem 0",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
        Section failed to render
      </div>
      <div style={{ opacity: 0.9 }}>
        <code style={{ fontFamily: "monospace" }}>{sectionType}</code> threw
        an error. Check the browser console for details.
      </div>
      <div
        style={{
          opacity: 0.6,
          fontSize: "0.75rem",
          marginTop: "0.25rem",
          fontFamily: "monospace",
        }}
      >
        section #{sectionId}
      </div>
    </div>
  );
}

/**
 * <Section> — wrapper that emits the `data-section-id` / `data-section-type`
 * attributes the storefront's PreviewBridge needs to relay clicks back
 * to the V3 customizer for "select section X" navigation.
 *
 * Use this around the top-level element of every section component:
 *
 *   export default function Hero({ settings, ...sectionMeta }) {
 *     return (
 *       <Section id={sectionMeta.id} type="hero">
 *         <h1>{settings.headline}</h1>
 *       </Section>
 *     );
 *   }
 *
 * Without `data-section-id` on a real DOM ancestor, clicking anywhere
 * in the section in the customizer iframe falls through to the page
 * background and the merchant has to use the section list panel to
 * select sections — slow and confusing.
 *
 * Errors thrown by `children` are caught by an internal ErrorBoundary
 * so one bad section doesn't unmount its siblings. Customize the
 * fallback via `errorFallback`.
 */
export function Section({
  id,
  type,
  groupId,
  errorFallback,
  children,
  ...rest
}: SectionProps) {
  return (
    <section
      data-section-id={id}
      data-section-type={type}
      data-group-id={groupId}
      {...rest}
    >
      <SectionErrorBoundary
        sectionId={id}
        sectionType={type}
        fallback={errorFallback ?? defaultSectionFallback(type, id)}
      >
        {children}
      </SectionErrorBoundary>
    </section>
  );
}

interface BlockProps extends HTMLAttributes<HTMLDivElement> {
  /** Block instance id within its parent section. */
  id: string;
  type: string;
  /** Override the fallback shown when this block throws. */
  errorFallback?: ReactNode;
  children: ReactNode;
}

/**
 * <Block> — analog to <Section> for nested block selection. Same DOM
 * attribute contract; PreviewBridge reads `data-block-id` and reports
 * the block as selected when its child clicks bubble up.
 *
 * Wraps `children` in the same per-instance ErrorBoundary as <Section>
 * so a bad block within a section isolates its failure.
 */
export function Block({ id, type, errorFallback, children, ...rest }: BlockProps) {
  return (
    <div data-block-id={id} data-block-type={type} {...rest}>
      <SectionErrorBoundary
        sectionId={id}
        sectionType={type}
        fallback={errorFallback ?? defaultSectionFallback(type, id)}
      >
        {children}
      </SectionErrorBoundary>
    </div>
  );
}
