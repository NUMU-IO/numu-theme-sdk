"use client";

/**
 * lib-newsletter — an email signup that really saves the subscriber.
 *
 * Every theme's own newsletter section (14 of them) only flips local state and
 * says "subscribed" without sending anything. This one posts to the host proxy
 * `/api/storefront/newsletter`, which records the email as a customer with
 * `accepts_marketing` and the `newsletter` tag, so the merchant can export and
 * target the list from Customers.
 *
 * Styles: `centered` (heading over the form), `card` (a tinted panel), `split`
 * (an image beside the form; without an image it lays out like `card`).
 *
 * The form always has content (localized defaults), so there is no empty
 * state. Inside the editor a submit never posts — it would add a real customer
 * to the merchant's store — and says so instead.
 */

import { useId, useState, type FormEvent } from "react";
import { useLocale } from "../../hooks/useLocalization";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { applyImageTransform, asImageTransform } from "../../utils/imageTransform";
import { useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, imageAlt, imageUrl, localized, responsiveImg, str } from "../_shared";
import type { LibrarySectionProps } from "../index";

export type NewsletterResult = "ok" | "invalid" | "busy" | "error";

/**
 * POST one signup to the host proxy. `website` is the honeypot's value; the
 * backend answers the same for a filled honeypot, so bots learn nothing.
 */
export async function subscribeNewsletter(email: string, website = ""): Promise<NewsletterResult> {
  try {
    const res = await fetch("/api/storefront/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, website }),
    });
    if (res.ok) return "ok";
    if (res.status === 400 || res.status === 422) return "invalid";
    if (res.status === 429) return "busy";
    return "error";
  } catch {
    return "error";
  }
}

type Status = "idle" | "sending" | "editor" | NewsletterResult;

const STYLES = ["centered", "card", "split"];
const SPLIT_IMG = { widths: [384, 640, 768, 1024], sizes: "(min-width: 768px) 50vw, 100vw" } as const;

const CSS = `
.lib-news{padding-block:clamp(2.5rem,6vw,4.5rem)}
.lib-news-panel{display:grid;gap:2rem;align-items:center}
.lib-news.is-card .lib-news-panel,.lib-news.is-split .lib-news-panel{padding:clamp(1.5rem,5vw,3rem);border-radius:1rem;background:color-mix(in srgb,var(--theme-color-accent,currentColor) 8%,transparent)}
@media (min-width:768px){.lib-news.is-split .lib-news-panel.has-image{grid-template-columns:1fr 1fr}}
.lib-news-inner{display:flex;flex-direction:column;gap:.75rem;inline-size:100%;max-inline-size:36rem;margin-inline:auto;text-align:center}
.lib-news.is-split .has-image .lib-news-inner{margin-inline:0;text-align:start}
.lib-news-media{position:relative;aspect-ratio:4/3;overflow:hidden;border-radius:.75rem}
.lib-news-media img{position:absolute;inset:0;inline-size:100%;block-size:100%;object-fit:cover}
.lib-news-heading{font-size:clamp(1.5rem,3vw,2.25rem)}
.lib-news-text{margin:0;opacity:.75}
.lib-news-form{display:flex;flex-wrap:wrap;gap:.5rem;margin-block-start:.5rem}
.lib-news-input{flex:1 1 14rem;min-inline-size:0;padding:.75rem 1rem;border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:.5rem;background:transparent;color:inherit;font:inherit}
.lib-news-button{flex:0 0 auto;padding:.75rem 1.5rem;border:0;border-radius:.5rem;background:var(--theme-color-accent,#111);color:var(--theme-color-background,#fff);font:inherit;font-weight:600;cursor:pointer}
.lib-news-button:disabled{opacity:.6;cursor:progress}
.lib-news-status{margin:0;min-block-size:1.25em;font-size:.875rem}
.lib-news-status.is-error{color:var(--theme-color-error,#b42318)}
.lib-news-note{margin:0;font-size:.75rem;opacity:.6}
.lib-sr{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
`;

export default function Newsletter({ instance }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();
  const id = useId();
  const [status, setStatus] = useState<Status>("idle");
  const t = (en: string, ar: string) => localized(locale, en, ar);
  // Unset shows the default; an empty string is the merchant hiding the line.
  const text = (v: unknown, en: string, ar: string) => (typeof v === "string" ? v : t(en, ar));

  const style = STYLES.includes(str(s.style)) ? str(s.style) : "centered";
  const image = style === "split" ? imageUrl(s.image) : "";
  const heading = text(s.heading, "Be the first to know", "اشترك وخليك أول واحد يعرف");
  const body = text(s.text, "New arrivals and offers, straight to your inbox.", "المنتجات الجديدة والعروض توصلك على الإيميل.");
  const note = str(s.note);

  const messages: Record<Status, string> = {
    idle: "",
    sending: "",
    ok: str(s.success_text) || t("You're in. Thanks for subscribing!", "تمام، اشتركت! شكرًا ليك"),
    invalid: t("That email doesn't look right.", "الإيميل ده مش مظبوط."),
    busy: t("Too many tries. Try again in a minute.", "محاولات كتير، جرّب تاني بعد دقيقة."),
    error: t("Something went wrong. Try again.", "حصلت مشكلة، جرّب تاني."),
    editor: t("Sign-ups are off in the editor. Try it on your store.", "الاشتراك مش بيتبعت من المحرر، جرّبه على المتجر."),
  };
  const isError = status === "invalid" || status === "busy" || status === "error";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (insideEditor) {
      setStatus("editor");
      return;
    }
    const data = new FormData(e.currentTarget);
    setStatus("sending");
    setStatus(await subscribeNewsletter(String(data.get("email") ?? "").trim(), String(data.get("website") ?? "")));
  }

  return (
    <section className={`lib-section lib-news is-${style}`}>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-newsletter" css={CSS} />
      <div className="lib-container">
        <div className={`lib-news-panel${image ? " has-image" : ""}`}>
          {image && (
            <div className="lib-news-media">
              <img
                {...responsiveImg(image, SPLIT_IMG)}
                alt={imageAlt(s.image, "")}
                loading="lazy"
                decoding="async"
                style={applyImageTransform(asImageTransform(s.image), "cover")}
              />
            </div>
          )}
          <div className="lib-news-inner">
            {heading && <h2 className="lib-heading lib-news-heading">{heading}</h2>}
            {body && <p className="lib-news-text">{body}</p>}
            {status !== "ok" && (
              <form className="lib-news-form" onSubmit={onSubmit}>
                <label htmlFor={`${id}-email`} className="lib-sr">
                  {t("Email address", "الإيميل")}
                </label>
                <input
                  id={`${id}-email`}
                  className="lib-news-input"
                  type="email"
                  name="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  dir="ltr"
                  placeholder={str(s.placeholder) || t("Your email", "إيميلك")}
                />
                <input className="lib-sr" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
                <button className="lib-news-button" type="submit" disabled={status === "sending"}>
                  {status === "sending" ? t("Sending…", "ثانية…") : str(s.button_text) || t("Subscribe", "اشترك")}
                </button>
              </form>
            )}
            <p className={`lib-news-status${isError ? " is-error" : ""}`} role="status" aria-live="polite">
              {messages[status]}
            </p>
            {note && <p className="lib-news-note">{note}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
