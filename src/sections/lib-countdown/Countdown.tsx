"use client";

/**
 * lib-countdown — "the offer ends in" timer with an optional button.
 *
 * `ends_at` is a wall-clock time like `2026-10-01T23:59`, read in Cairo time
 * (Africa/Cairo, DST-aware). The SDK's Store carries no timezone, and NUMU
 * merchants are Egyptian; a value with an explicit `Z` / `+02:00` is honoured
 * as written.
 *
 * The server and the first client render show `--` in every unit, since the
 * server cannot know the visitor's clock. The live time starts after mount,
 * ticking once a second. With `after_end: hide` an offer that has already
 * ended disappears after mount; with `message` the timer is replaced by the
 * ended text and the button goes away. Digits are Western (0-9) and LTR in
 * both languages, like prices.
 */

import { useEffect, useState } from "react";

import { Link } from "../../components/Link";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, localized, str } from "../_shared";
import type { LibrarySectionProps } from "../index";

const STORE_TZ = "Africa/Cairo";
const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const ZONED_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

let tzFormat: Intl.DateTimeFormat | undefined;

/** Cairo's UTC offset, in ms, at the instant `utcMs`. */
function cairoOffset(utcMs: number): number {
  tzFormat ??= new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of tzFormat.formatToParts(new Date(utcMs))) p[part.type] = Number(part.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}

/**
 * The end of the offer as epoch ms, or null when empty or not a real date.
 * A date alone means the start of that day.
 */
export function parseEndsAt(raw: unknown): number | null {
  const v = str(raw).trim();
  if (!v) return null;
  if (ZONED_RE.test(v)) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  const m = v.match(WALL_RE);
  if (!m) return null;
  const [y, mo, d, h = 0, mi = 0, sec = 0] = m.slice(1).map((x) => (x === undefined ? undefined : Number(x))) as number[];
  if (h > 23 || mi > 59 || sec > 59) return null;
  const wall = Date.UTC(y, mo - 1, d, h, mi, sec);
  const check = new Date(wall);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  // Two passes settle the offset across a DST change.
  const guess = wall - cairoOffset(wall);
  return wall - cairoOffset(guess);
}

const pad = (n: number) => String(n).padStart(2, "0");

const CSS = `
.lib-cd{text-align:center}
.lib-cd.is-band{padding-block:1.5rem;background:var(--theme-color-accent,#111);color:#fff}
.lib-cd.is-card{padding-block:3rem}
.lib-cd-inner{display:flex;flex-direction:column;align-items:center;gap:1rem}
.lib-cd.is-band .lib-cd-inner{flex-direction:row;flex-wrap:wrap;justify-content:center;gap:.75rem 2rem}
.lib-cd.is-card .lib-cd-inner{max-inline-size:36rem;padding:2rem 1.5rem;border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:.5rem}
.lib-cd-heading{font-size:clamp(1.25rem,2.4vw,1.75rem)}
.lib-cd.is-band .lib-cd-heading{font-size:clamp(1.125rem,2vw,1.5rem)}
.lib-cd-text{margin:0;max-inline-size:50ch}
.lib-cd-timer{display:flex;gap:.75rem}
.lib-cd-unit{display:flex;flex-direction:column;align-items:center;min-inline-size:3.5rem}
.lib-cd-num{font-family:var(--theme-font-heading,inherit);font-size:clamp(1.5rem,3.5vw,2.25rem);font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.lib-cd-unit .lib-label{margin-block-start:.375rem;opacity:.8}
.lib-cd-ended{margin:0;font-weight:500}
.lib-cd-cta{display:inline-block;padding:.75rem 1.5rem;border:1px solid currentColor;color:inherit;text-decoration:none;font-size:.875rem;font-weight:500}
.lib-cd-cta:hover{opacity:.8}
`;

export default function Countdown({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();
  const end = parseEndsAt(s.ends_at);

  // null until mount: the server and the first client render show "--".
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (end === null) return;
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= end) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [end]);

  if (end === null) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">
          {localized(locale, "Write when the offer ends, like ", "اكتب العرض هيخلص إمتى، بالشكل ده ")}
          <span dir="ltr">2026-10-01T23:59</span>
          {localized(locale, " (Cairo time)", " (بتوقيت القاهرة)")}
        </p>
      </section>
    ) : null;
  }

  const remaining = now === null ? null : Math.max(0, end - now);
  const ended = remaining === 0;
  const afterEnd = str(s.after_end) === "message" ? "message" : "hide";

  if (ended && afterEnd === "hide") {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">
          {localized(locale, "This offer has ended, so the store hides this section", "العرض ده خلص، فالقسم ده مش باين في المتجر")}
        </p>
      </section>
    ) : null;
  }

  const style = str(s.style) === "card" ? "card" : "band";
  const heading = str(s.heading);
  const text = str(s.text);
  const ctaText = str(s.cta_text);

  const digits =
    remaining === null
      ? ["--", "--", "--", "--"]
      : [
          Math.floor(remaining / 86_400_000),
          Math.floor(remaining / 3_600_000) % 24,
          Math.floor(remaining / 60_000) % 60,
          Math.floor(remaining / 1000) % 60,
        ].map(pad);
  const labels = [
    localized(locale, "days", "يوم"),
    localized(locale, "hours", "ساعة"),
    localized(locale, "minutes", "دقيقة"),
    localized(locale, "seconds", "ثانية"),
  ];

  return (
    <section className={`lib-section lib-cd is-${style}`}>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-countdown" css={CSS} />
      <div className="lib-container">
        <div className="lib-cd-inner">
          {(heading || text) && (
            <div>
              {heading && (
                <h2 className="lib-heading lib-cd-heading">
                  <InlineText sectionId={sectionId} settingKey="heading" value={heading} />
                </h2>
              )}
              {text && (
                <p className="lib-cd-text">
                  <InlineText sectionId={sectionId} settingKey="text" value={text} multiline />
                </p>
              )}
            </div>
          )}
          {ended ? (
            <p className="lib-cd-ended">{str(s.ended_text) || localized(locale, "This offer has ended", "العرض خلص")}</p>
          ) : (
            <div className="lib-cd-timer" role="timer">
              {labels.map((label, i) => (
                <span key={label} className="lib-cd-unit">
                  <span className="lib-cd-num" dir="ltr">
                    {digits[i]}
                  </span>
                  <span className="lib-label">{label}</span>
                </span>
              ))}
            </div>
          )}
          {!ended && ctaText && (
            <Link to={str(s.cta_link) || "/products"} className="lib-cd-cta">
              <InlineText sectionId={sectionId} settingKey="cta_text" value={ctaText} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
