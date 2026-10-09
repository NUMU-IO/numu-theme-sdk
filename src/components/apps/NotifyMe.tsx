"use client";

/**
 * Back in Stock — the "notify me" form under a sold-out product's buy button.
 *
 * Rendered by `ProductAppSlot` at `after_buy`, only when the store has the
 * `back-in-stock` app. It shows only while the chosen variant (or, with no
 * variant chosen, the whole product) is sold out.
 *
 * The store's sign-up choice (phone or email, or one of them only) comes from
 * the host's same-origin `/api/apps/back-in-stock/config`, fetched once per
 * page when the form first shows. Until it answers, the form renders with the
 * phone field, disabled; the field area keeps its height whatever the answer,
 * so nothing on the page moves. A "not installed" answer (or any failure)
 * removes the form.
 *
 * Inside the theme editor a submit never posts — it would sign the merchant up
 * on their own store — and says so instead.
 */

import { useEffect, useId, useState, type FormEvent } from "react";
import { useLocale } from "../../hooks/useLocalization";
import { useInsideEditor } from "../../sections/InlineText";
import { LibStyle, localized } from "../../sections/_shared";
import type { Product, ProductVariant } from "../../types/entities";
import { isSoldOut } from "../../utils/availability";

const BASE = "/api/apps/back-in-stock";

export type NotifyContact = "phone_or_email" | "phone" | "email";
const CONTACTS: NotifyContact[] = ["phone_or_email", "phone", "email"];

/** `fetch` that gives up after `ms`. `AbortSignal.timeout` is missing before Safari 16. */
function fetchWithin(url: string, ms: number, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

let configRequest: Promise<NotifyContact | null> | null = null;

/**
 * The store's sign-up choice, one request per page; null hides the form.
 * Only an answer is kept: after a failure (or a "hide"), the next form asks again.
 */
export function loadNotifyConfig(): Promise<NotifyContact | null> {
  configRequest ??= fetchWithin(`${BASE}/config`, 8_000, { headers: { Accept: "application/json" } })
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => (CONTACTS.includes(body?.contact) ? (body.contact as NotifyContact) : null))
    .catch(() => null)
    .then((contact) => {
      if (contact === null) configRequest = null;
      return contact;
    });
  return configRequest;
}

/** Tests only: forget the cached config answer. */
export function resetNotifyConfig(): void {
  configRequest = null;
}

export type NotifyResult =
  | "subscribed"
  | "already"
  | "available"
  | "invalid_phone"
  | "invalid_email"
  | "channel_unavailable"
  | "busy"
  | "error";

/** POST one sign-up through the host relay and name the outcome. */
export async function subscribeNotify(body: {
  product_id: string;
  variant_id?: string;
  phone?: string;
  email?: string;
  locale: "ar" | "en";
  website: string;
}): Promise<NotifyResult> {
  try {
    const res = await fetchWithin(`${BASE}/subscribe`, 15_000, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { status?: string; code?: string } | null;
    if (res.ok) {
      const status = data?.status;
      return status === "already" || status === "available" ? status : "subscribed";
    }
    if (res.status === 409) return "channel_unavailable";
    if (res.status === 429) return "busy";
    if (data?.code === "invalid_phone" || data?.code === "invalid_email") return data.code;
    return "error";
  } catch {
    return "error";
  }
}

type Status = "idle" | "sending" | "editor" | NotifyResult;
const DONE: Status[] = ["subscribed", "already", "available"];
const ERRORS: Status[] = ["invalid_phone", "invalid_email", "channel_unavailable", "busy", "error"];

const CSS = `
.numu-notify{display:grid;gap:.5rem;margin-block-start:1rem;padding:1rem;border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:.75rem;font-family:inherit}
.numu-notify-heading{margin:0;font-size:1rem;font-weight:600}
.numu-notify-form{display:grid;gap:.5rem;margin:0}
.numu-notify-label{font-size:.875rem}
.numu-notify-input{box-sizing:border-box;inline-size:100%;min-block-size:44px;padding:.625rem .875rem;border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:.5rem;background:transparent;color:inherit;font:inherit}
.numu-notify-button{min-block-size:44px;padding:.625rem 1.25rem;border:0;border-radius:.5rem;background:var(--theme-color-accent,#111);color:var(--theme-color-background,#fff);font:inherit;font-weight:600;cursor:pointer}
.numu-notify-button:disabled{opacity:.6;cursor:progress}
.numu-notify-switch-row{min-block-size:44px}
.numu-notify-switch{min-block-size:44px;padding:0;border:0;background:none;color:inherit;font:inherit;font-size:.875rem;text-decoration:underline;cursor:pointer}
.numu-notify-note{margin:0;font-size:.75rem;opacity:.7}
.numu-notify-status{margin:0;min-block-size:1.25em;font-size:.875rem}
.numu-notify-status.is-error{color:var(--theme-color-error,#b42318)}
.numu-notify-hp{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
`;

const PHONE_INPUT = { type: "tel", inputMode: "tel", autoComplete: "tel", maxLength: 32, placeholder: "01012345678" } as const;
const EMAIL_INPUT = { type: "email", autoComplete: "email", maxLength: 254, placeholder: "name@example.com" } as const;

export interface NotifyMeProps {
  product: Product;
  /** The theme's selected variant; empty before the shopper picks one. */
  variant?: ProductVariant | null;
}

export function NotifyMe({ product, variant }: NotifyMeProps) {
  const shown = isSoldOut(product, variant);
  // undefined = still asking; null = not installed (or the ask failed).
  const [contact, setContact] = useState<NotifyContact | null | undefined>(undefined);

  useEffect(() => {
    if (!shown || contact !== undefined) return;
    let live = true;
    loadNotifyConfig().then((c) => live && setContact(c));
    return () => {
      live = false;
    };
  }, [shown, contact]);

  if (!shown || contact === null) return null;
  // A new variant starts a fresh form (status, typed contact).
  return <NotifyForm key={variant?.id ?? product.id} product={product} variant={variant} contact={contact} />;
}

function NotifyForm({ product, variant, contact }: NotifyMeProps & { contact: NotifyContact | undefined }) {
  const locale = useLocale();
  const insideEditor = useInsideEditor();
  const id = useId();
  const t = (en: string, ar: string) => localized(locale, en, ar);
  const [picked, setPicked] = useState<"phone" | "email">("phone");
  const [status, setStatus] = useState<Status>("idle");

  const channel = contact === "email" ? "email" : contact === "phone" ? "phone" : picked;
  const canSwitch = contact === "phone_or_email";

  const messages: Record<Status, string> = {
    idle: "",
    sending: "",
    subscribed: t("Done — we'll tell you as soon as it's back.", "تمام، هنبلّغك أول ما يرجع."),
    already: t(
      "You're already on the list.",
      channel === "phone"
        ? "الرقم ده متسجّل قبل كده، هنبلّغك أول ما يرجع."
        : "الإيميل ده متسجّل قبل كده، هنبلّغك أول ما يرجع.",
    ),
    available: t("Good news — it's available now. Refresh to order.", "ده متاح دلوقتي! حدّث الصفحة واطلبه."),
    invalid_phone: t(
      "Enter an Egyptian mobile number, like 01012345678",
      "اكتب رقم موبايل مصري صح، زي 01012345678",
    ),
    invalid_email: t("That email doesn't look right", "الإيميل ده مش مظبوط"),
    channel_unavailable: t(
      "WhatsApp alerts aren't available here — leave your email.",
      "التنبيه على واتساب مش متاح هنا، سيب إيميلك بدل كده.",
    ),
    busy: t("Too many requests — try again shortly.", "في ضغط دلوقتي، جرّب كمان شوية."),
    error: t("Something went wrong — try again.", "حصلت مشكلة، جرّب تاني."),
    editor: t(
      "Preview only — on your store this saves the request.",
      "ده عرض بس — في المتجر الحقيقي الزرار بيسجّل الطلب.",
    ),
  };
  const isError = ERRORS.includes(status);
  const fieldError = status === "invalid_phone" || status === "invalid_email";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (insideEditor) {
      setStatus("editor");
      return;
    }
    const data = new FormData(e.currentTarget);
    const value = String(data.get("contact") ?? "").trim();
    if (!value) {
      setStatus(channel === "phone" ? "invalid_phone" : "invalid_email");
      return;
    }
    setStatus("sending");
    const result = await subscribeNotify({
      product_id: String(product.id),
      ...(variant?.id ? { variant_id: String(variant.id) } : {}),
      ...(channel === "phone" ? { phone: value } : { email: value }),
      locale: localized(locale, "en", "ar") as "ar" | "en",
      website: String(data.get("website") ?? ""),
    });
    if (result === "channel_unavailable" && canSwitch) setPicked("email");
    setStatus(result);
  }

  const statusId = `${id}-status`;
  return (
    <div className="numu-notify">
      <LibStyle id="numu-notify" css={CSS} />
      <p className="numu-notify-heading">
        {t("Sold out — want a heads-up when it's back?", "خلص دلوقتي — نبلّغك أول ما يرجع؟")}
      </p>
      {!DONE.includes(status) && (
        <form className="numu-notify-form" onSubmit={onSubmit}>
          <label htmlFor={`${id}-contact`} className="numu-notify-label">
            {channel === "phone" ? t("Mobile number (WhatsApp)", "رقم الموبايل (واتساب)") : t("Email", "الإيميل")}
          </label>
          <input
            key={channel}
            id={`${id}-contact`}
            className="numu-notify-input"
            name="contact"
            required
            dir="ltr"
            disabled={contact === undefined}
            aria-invalid={fieldError || undefined}
            aria-describedby={fieldError ? statusId : undefined}
            {...(channel === "phone" ? PHONE_INPUT : EMAIL_INPUT)}
          />
          <input className="numu-notify-hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <button
            className="numu-notify-button"
            type="submit"
            disabled={contact === undefined || status === "sending"}
          >
            {status === "sending" ? t("Sending…", "ثانية…") : t("Notify me", "بلّغوني لما يرجع")}
          </button>
          <div className="numu-notify-switch-row">
            {canSwitch && (
              <button
                type="button"
                className="numu-notify-switch"
                onClick={() => {
                  setPicked(channel === "phone" ? "email" : "phone");
                  setStatus("idle");
                }}
              >
                {channel === "phone"
                  ? t("Prefer email?", "عايز التنبيه على الإيميل؟")
                  : t("Prefer WhatsApp?", "عايز التنبيه على واتساب؟")}
              </button>
            )}
          </div>
          <p className="numu-notify-note">
            {t("We'll send one message when it's back.", "هنبعتلك رسالة واحدة بس لما ده يرجع.")}
          </p>
        </form>
      )}
      <p id={statusId} className={`numu-notify-status${isError ? " is-error" : ""}`} role="status" aria-live="polite">
        {messages[status]}
      </p>
    </div>
  );
}
