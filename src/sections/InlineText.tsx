"use client";

/**
 * Inline text editing for library sections, inside the theme editor.
 *
 * Ported from the V3 themes' `_inline-editable.tsx` (Vionne / Gilded / Empire),
 * which is theme-agnostic: only the class prefix changes. Inside the
 * customizer iframe the text shows a hover frame; a click makes it
 * contenteditable, and blur or Enter posts `numu:editor:inline-edit` to the
 * parent with `{ sectionId, blockId, groupId, key, value }`. The hub patches
 * the draft and sends `numu:theme:update` back. Outside the editor it renders
 * plain text.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { LibStyle } from "./_shared";

export interface InlineTextProps {
  sectionId: string;
  blockId?: string;
  groupId?: string;
  settingKey: string;
  value: string;
  as?: "inline" | "block";
  multiline?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const CSS = `
.lib-inline-edit--armed{cursor:text;border-radius:2px;outline:1px dashed transparent;outline-offset:2px}
.lib-inline-edit--armed:hover{outline-color:currentColor}
.lib-inline-edit--editing{outline:2px solid currentColor}
`;

function isInsideEditor(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("editor")) return true;
  } catch {
    // URLSearchParams does not throw on a location search string.
  }
  return window.parent !== window;
}

/**
 * True inside the theme editor — decided after mount, so the server render and
 * the first client render always agree (false) and hydration never mismatches.
 */
export function useInsideEditor(): boolean {
  const [inside, setInside] = useState(false);
  useEffect(() => {
    setInside(isInsideEditor());
  }, []);
  return inside;
}

export function InlineText({
  sectionId,
  blockId,
  groupId,
  settingKey,
  value,
  as = "inline",
  multiline = false,
  className,
  style,
  children,
}: InlineTextProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  // Plain text on the server and first paint; affordances arm after mount.
  const inEditor = useInsideEditor();

  const commit = useCallback(
    (next: string) => {
      setEditing(false);
      ref.current?.removeAttribute("contenteditable");
      const trimmed = multiline ? next : next.replace(/\s+/g, " ").trim();
      if (trimmed === value) return;
      try {
        window.parent.postMessage(
          {
            type: "numu:editor:inline-edit",
            payload: { sectionId, blockId, groupId, key: settingKey, value: trimmed },
          },
          "*",
        );
      } catch (err) {
        console.warn("[numu-library] inline-edit postMessage failed", err);
      }
    },
    [sectionId, blockId, groupId, settingKey, value, multiline],
  );

  const cancel = useCallback(() => {
    setEditing(false);
    if (ref.current) {
      ref.current.removeAttribute("contenteditable");
      ref.current.textContent = value;
    }
  }, [value]);

  const startEditing = useCallback(
    (e: React.MouseEvent) => {
      if (!inEditor) return;
      e.preventDefault();
      e.stopPropagation();
      const el = ref.current;
      if (!el) return;
      el.setAttribute("contenteditable", "true");
      el.focus();
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setEditing(true);
    },
    [inEditor],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!editing) return;
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        ref.current?.blur();
      } else if (e.key === "Enter" && !multiline && !e.shiftKey) {
        e.preventDefault();
        commit(ref.current?.textContent ?? "");
        ref.current?.blur();
      }
    },
    [editing, multiline, commit, cancel],
  );

  const onBlur = useCallback(() => {
    if (editing) commit(ref.current?.textContent ?? "");
  }, [editing, commit]);

  const Tag = as === "block" ? "div" : "span";
  const classes = [
    className,
    "lib-inline-edit",
    inEditor ? "lib-inline-edit--armed" : "",
    editing ? "lib-inline-edit--editing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <LibStyle id="lib-inline-edit" css={CSS} />
      <Tag
        ref={ref as React.Ref<HTMLElement & HTMLDivElement>}
        className={classes}
        style={style}
        data-numu-inline-key={settingKey}
        data-numu-inline-section={sectionId}
        data-numu-inline-block={blockId}
        onClick={inEditor ? startEditing : undefined}
        onClickCapture={inEditor && editing ? (e) => e.stopPropagation() : undefined}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        suppressContentEditableWarning
      >
        {children ?? value}
      </Tag>
    </>
  );
}
