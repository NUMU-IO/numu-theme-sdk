"use client";

/**
 * lib-bundle-builder — "Pick N": the shopper picks N products (choosing an
 * option where a product has several), watches a running total, and adds
 * them all to the bag in one tap.
 *
 * Products come from a collection, a tag or a hand-picked list, filtered the
 * way lib-product-rail filters them. The offer price is never typed in by the
 * merchant: it is quoted from an active automatic multibuy promotion with the
 * same N (see `offerQuote` in ./bundle), and after adding, the saving shown is
 * the one the engine put in `cart.applied_promotions`. Promotions load after
 * hydration, so the server HTML shows the regular total only.
 */

import { useState } from "react";

import { LibProductCard } from "../../commerce/LibProductCard";
import { fetchProductDetail, inStock } from "../../commerce/core";
import { Money } from "../../components/Money";
import { useActivePromotions } from "../../hooks/useActivePromotions";
import { useCart } from "../../hooks/useCart";
import { useLocale } from "../../hooks/useLocalization";
import { usePage } from "../../hooks/usePage";
import { useProducts } from "../../hooks/useProducts";
import { useResolvedSettings } from "../../hooks/useResolvedSettings";
import { multibuyOffers } from "../../lib/promotions";
import type { Product } from "../../types/entities";
import { InlineText, useInsideEditor } from "../InlineText";
import { BASE_CSS, LibStyle, localized, str } from "../_shared";
import type { LibrarySectionProps } from "../index";
import { addLines, clampInt, hintOffer, offerQuote, pickPrice, readyLines, sourceProducts, variantLabel, type Pick } from "./bundle";

const STYLES = ["grid", "sticky"];

const CSS = `
.lib-bb{padding-block:3rem}
.lib-bb-head{margin-block-end:1.5rem;text-align:center}
.lib-bb-title{font-size:clamp(1.5rem,3vw,2.25rem)}
.lib-bb-sub{margin:.5rem 0 0}
.lib-bb-hint{margin:.75rem 0 0;font-weight:600}
.lib-bb-body{display:grid;gap:1.5rem}
.lib-bb-grid{display:grid;gap:1rem;grid-template-columns:repeat(2,minmax(0,1fr))}
@media (min-width:768px){.lib-bb-grid{grid-template-columns:repeat(auto-fill,minmax(12rem,1fr))}}
.lib-bb-item{display:flex;flex-direction:column;gap:.5rem;min-inline-size:0}
.lib-bb-item.is-picked .lib-card-media{outline:2px solid var(--theme-color-accent,currentColor);outline-offset:-2px}
.lib-bb-pick,.lib-bb-add{font:inherit;cursor:pointer}
.lib-bb-pick{inline-size:100%;padding-block:.625rem;padding-inline:.75rem;border:1px solid currentColor;background:transparent;color:inherit;font-size:.8rem;font-weight:500}
.lib-bb-pick[aria-pressed="true"]{border-color:var(--theme-color-accent,currentColor);background:var(--theme-color-accent,#111);color:var(--theme-color-background,#fff)}
.lib-bb-pick:disabled,.lib-bb-add:disabled{opacity:.5;cursor:not-allowed}
.lib-bb-pick:focus-visible,.lib-bb-add:focus-visible,.lib-bb-remove:focus-visible,.lib-bb-select:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.lib-bb-select{inline-size:100%;padding-block:.5rem;padding-inline:.5rem;border:1px solid color-mix(in srgb,currentColor 30%,transparent);background:transparent;color:inherit;font:inherit;font-size:.8rem}
.lib-bb-summary{display:flex;flex-direction:column;gap:.75rem;padding:1.25rem;border:1px solid color-mix(in srgb,currentColor 15%,transparent);background:var(--theme-color-background,transparent)}
.lib-bb-progress{margin:0;font-weight:600}
.lib-bb-bar{display:block;block-size:4px;background:color-mix(in srgb,currentColor 12%,transparent)}
.lib-bb-bar>span{display:block;block-size:100%;background:var(--theme-color-accent,currentColor);transition:inline-size .3s ease}
.lib-bb-lines{display:flex;flex-direction:column;gap:.5rem;margin:0;padding:0;list-style:none}
.lib-bb-line{display:flex;align-items:baseline;justify-content:space-between;gap:.75rem;font-size:.875rem}
.lib-bb-line-name{min-inline-size:0}
.lib-bb-remove{margin-inline-start:.5rem;padding:0;border:0;background:none;color:inherit;font:inherit;font-size:.75rem;text-decoration:underline;cursor:pointer}
.lib-bb-total{display:flex;align-items:baseline;justify-content:space-between;gap:.75rem;margin:0;font-weight:600}
.lib-bb-was{margin-inline-end:.5rem;font-weight:400;opacity:.6}
.lib-bb-note{margin:0;font-size:.75rem}
.lib-bb-editor{margin:.75rem auto 0;max-inline-size:40rem;padding:.75rem;border:1px dashed color-mix(in srgb,currentColor 30%,transparent)}
.lib-bb-add{padding-block:.875rem;padding-inline:1rem;border:1px solid var(--theme-color-accent,currentColor);background:var(--theme-color-accent,#111);color:var(--theme-color-background,#fff);font-weight:600}
.lib-bb-msg{margin:0;font-size:.875rem}
.lib-bb-msg.is-error{color:#b42318}
.lib-bb-ghost{display:flex;flex-direction:column;gap:.5rem}
.lib-bb-ghost-media{display:block;aspect-ratio:3/4;background:color-mix(in srgb,currentColor 8%,transparent)}
.lib-bb-ghost-line{display:block;block-size:2.5rem;background:color-mix(in srgb,currentColor 8%,transparent)}
.lib-bb.is-sticky .lib-bb-summary{position:sticky;inset-block-end:0;z-index:2}
@media (min-width:1024px){
.lib-bb.is-sticky .lib-bb-body{grid-template-columns:minmax(0,1fr) 20rem;align-items:start}
.lib-bb.is-sticky .lib-bb-summary{inset-block:1rem auto}
}
@media (prefers-reduced-motion:reduce){.lib-bb-bar>span{transition:none}}
`;

type Status =
  | { kind: "idle" }
  | { kind: "adding" }
  | { kind: "done"; offerId?: string }
  | { kind: "error"; text: string };

export default function BundleBuilder({ instance, sectionId }: LibrarySectionProps) {
  const locale = useLocale();
  const s = useResolvedSettings(instance);
  const insideEditor = useInsideEditor();
  const page = usePage();
  const { cart, addItem } = useCart();
  const { products: fetched, loading } = useProducts({ limit: 100, fetchIfMissing: true });
  const promotions = useActivePromotions("/", locale);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const ar = localized(locale, "", "ar") === "ar";
  const pageProducts = page?.data?.products;
  // ponytail: filters run over at most the first 100 fetched products (or what
  // the page pre-loaded), same ceiling as lib-product-rail, until the host
  // proxy forwards category/tag filters to the API.
  const pool = (Array.isArray(pageProducts) ? pageProducts : fetched) as Product[];
  const count = clampInt(s.pick_count, 2, 6, 3);
  const limit = Math.max(count, clampInt(s.limit, 4, 24, 12));
  const items = sourceProducts(pool, {
    source: str(s.source),
    collection: str(s.collection),
    tag: str(s.tag),
    productList: s.product_list,
  }).slice(0, limit);
  const waiting = loading && pool.length === 0;
  const showOffer = s.show_offer !== false;

  if (!waiting && items.filter(inStock).length < count) {
    return insideEditor ? (
      <section className="lib-section lib-empty">
        <LibStyle id="lib-base" css={BASE_CSS} />
        <p className="lib-muted">
          {localized(
            locale,
            `Pick a source with at least ${count} products in stock so shoppers can build a bundle.`,
            `اختار مصدر فيه ${count} منتجات متاحة على الأقل عشان الزبون يقدر يكوّن باقة.`,
          )}
        </p>
      </section>
    ) : null;
  }

  const offers = showOffer ? multibuyOffers(promotions) : [];
  const hint = hintOffer(offers, count, items);
  const lines = readyLines(picks, count);
  const quote = lines ? offerQuote(offers, picks) : null;
  const regular = picks.reduce((sum, p) => sum + pickPrice(p), 0);
  const adding = status.kind === "adding";
  const style = STYLES.includes(str(s.style)) ? str(s.style) : "grid";
  const heading = str(s.heading) || localized(locale, "Build your bundle", "كوّن باقتك");
  const subheading =
    s.subheading === undefined
      ? count === 2
        ? localized(locale, "Pick 2 products and add them to your bag in one go.", "اختار منتجين وضيفهم للسلة مرة واحدة.")
        : localized(locale, `Pick ${count} products and add them to your bag in one go.`, `اختار ${count} منتجات وضيفهم للسلة مرة واحدة.`)
      : str(s.subheading);
  const hintHeadline = hint?.headline?.[ar ? "ar" : "en"];
  const savedAmount =
    status.kind === "done" && status.offerId ? (cart.applied_promotions ?? []).find((p) => p.id === status.offerId)?.amount ?? 0 : 0;

  const setVariants = (id: string, next: Partial<Pick>) =>
    setPicks((cur) => cur.map((p) => (p.product.id === id ? { ...p, ...next } : p)));

  const toggle = (product: Product) => {
    setStatus({ kind: "idle" });
    if (picks.some((p) => p.product.id === product.id)) {
      setPicks((cur) => cur.filter((p) => p.product.id !== product.id));
      return;
    }
    if (picks.length >= count || !inStock(product)) return;
    const known = product.variants?.length ? product.variants : null;
    setPicks((cur) => [...cur, { product, variants: known }]);
    if (known) return;
    fetchProductDetail(product.id).then(
      (detail) => setVariants(product.id, { variants: detail.variants ?? [] }),
      () => {
        setPicks((cur) => cur.filter((p) => p.product.id !== product.id));
        setStatus({
          kind: "error",
          text: localized(locale, `Couldn't load ${product.name}. Try again.`, `مقدرناش نحمّل ${product.name}، جرّب تاني.`),
        });
      },
    );
  };

  const addAll = async () => {
    if (!lines || adding) return;
    // A real add from the editor would fill the merchant's own cart.
    if (insideEditor) {
      setStatus({
        kind: "error",
        text: localized(locale, "Adding to the bag is off in the editor. Try it on your store.", "الإضافة للسلة مش شغالة جوّه المحرر، جرّبها على المتجر."),
      });
      return;
    }
    setStatus({ kind: "adding" });
    const offerId = quote?.offer.promotionId;
    const results = await addLines(addItem, lines, added);
    const done = [...added, ...results.filter((r) => r.ok).map((r) => r.line.key)];
    const failed = results.filter((r) => !r.ok);
    if (failed.length === 0) {
      setPicks([]);
      setAdded([]);
      setStatus({ kind: "done", offerId });
      return;
    }
    setAdded(done);
    const names = failed.map((r) => r.line.name).join(ar ? "، " : ", ");
    const reason = failed.map((r) => r.message).find(Boolean);
    const text =
      done.length === 0
        ? localized(locale, "Couldn't add the bundle.", "مقدرناش نضيف الباقة.")
        : localized(
            locale,
            `Added ${done.length} of ${lines.length}. Couldn't add: ${names}.`,
            `اتضاف ${done.length} من ${lines.length}. مقدرناش نضيف: ${names}.`,
          );
    setStatus({ kind: "error", text: reason ? `${text} ${reason}` : text });
  };

  const buttonText = str(s.button_text) || localized(locale, "Add bundle to bag", "ضيف الباقة للسلة");

  return (
    <section className={`lib-section lib-bb is-${style}`}>
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-bundle-builder" css={CSS} />
      <div className="lib-container">
        <div className="lib-bb-head">
          <h2 className="lib-heading lib-bb-title">
            <InlineText sectionId={sectionId} settingKey="heading" value={heading} />
          </h2>
          {subheading && <p className="lib-muted lib-bb-sub">{subheading}</p>}
          {hint && (
            <p className="lib-bb-hint">
              {hintHeadline || (
                <>
                  {localized(locale, `Any ${count} for `, `أي ${count} بـ `)}
                  <span dir="ltr">
                    <Money amount={hint.groupPriceMajor} />
                  </span>
                </>
              )}
            </p>
          )}
          {insideEditor && showOffer && !hint && (
            <p className="lib-bb-note lib-bb-editor">
              {localized(
                locale,
                `No automatic "Any ${count} for a fixed price" discount is active for these products, so shoppers see the regular total. Create one in Discounts in your dashboard.`,
                `مفيش خصم تلقائي «أي ${count} بسعر ثابت» شغال على المنتجات دي، فالزبون هيشوف السعر العادي. اعمل واحد من «الخصومات» في لوحة التحكم.`,
              )}
            </p>
          )}
        </div>
        <div className="lib-bb-body">
          <div className="lib-bb-grid" aria-busy={waiting || undefined}>
            {waiting
              ? Array.from({ length: Math.min(limit, 8) }, (_, i) => (
                  <div key={i} className="lib-bb-ghost" aria-hidden="true">
                    <span className="lib-bb-ghost-media" />
                    <span className="lib-bb-ghost-line" />
                  </div>
                ))
              : items.map((product) => {
                  const pick = picks.find((p) => p.product.id === product.id);
                  const soldOut = !inStock(product);
                  return (
                    <div key={product.id} className={pick ? "lib-bb-item is-picked" : "lib-bb-item"}>
                      <LibProductCard product={product} showQuickAdd={false} imageSizes="(min-width: 768px) 20vw, 50vw" />
                      <button
                        type="button"
                        className="lib-bb-pick"
                        aria-pressed={!!pick}
                        disabled={soldOut || (!pick && picks.length >= count)}
                        onClick={() => toggle(product)}
                      >
                        {pick ? localized(locale, "Picked", "متختار") : localized(locale, "Pick", "اختار")}
                      </button>
                      {pick && pick.variants === null && (
                        <span className="lib-bb-note lib-muted">{localized(locale, "Loading options…", "بنحمّل الاختيارات…")}</span>
                      )}
                      {pick && pick.variants && pick.variants.length > 1 && (
                        <select
                          className="lib-bb-select"
                          value={pick.variantId ?? ""}
                          aria-label={localized(locale, `Option for ${product.name}`, `اختيار ${product.name}`)}
                          onChange={(e) => setVariants(product.id, { variantId: e.target.value || undefined })}
                        >
                          <option value="" disabled>
                            {localized(locale, "Choose an option", "اختار النوع")}
                          </option>
                          {pick.variants.map((v) => {
                            const out = !(v.is_in_stock ?? v.in_stock ?? true);
                            return (
                              <option key={v.id} value={v.id} disabled={out}>
                                {(variantLabel(v) || v.id) + (out ? localized(locale, " (sold out)", " (خلصت)") : "")}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                  );
                })}
          </div>
          <aside className="lib-bb-summary" aria-label={localized(locale, "Your bundle", "باقتك")}>
            <p className="lib-bb-progress" role="status" aria-live="polite">
              {ar ? "اخترت " : "Picked "}
              <span dir="ltr">{picks.length}</span>
              {ar ? " من " : " of "}
              <span dir="ltr">{count}</span>
            </p>
            <span className="lib-bb-bar" aria-hidden="true">
              <span style={{ inlineSize: `${Math.round((picks.length / count) * 100)}%` }} />
            </span>
            {picks.length > 0 && (
              <ul className="lib-bb-lines">
                {picks.map((p) => {
                  const chosen = p.variants && p.variants.length > 1 ? p.variants.find((v) => v.id === p.variantId) : undefined;
                  return (
                    <li key={p.product.id} className="lib-bb-line">
                      <span className="lib-bb-line-name">
                        {p.product.name}
                        {chosen && <span className="lib-muted">{` · ${variantLabel(chosen)}`}</span>}
                        <button
                          type="button"
                          className="lib-bb-remove"
                          aria-label={localized(locale, `Remove ${p.product.name}`, `شيل ${p.product.name}`)}
                          onClick={() => toggle(p.product)}
                        >
                          {localized(locale, "Remove", "شيل")}
                        </button>
                      </span>
                      <span dir="ltr">
                        <Money amount={pickPrice(p)} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {picks.length > 0 && (
              <p className="lib-bb-total">
                <span>{localized(locale, "Total", "الإجمالي")}</span>
                <span dir="ltr">
                  {quote ? (
                    <>
                      <s className="lib-bb-was">
                        <Money amount={quote.regular} />
                      </s>
                      <Money amount={quote.total} />
                    </>
                  ) : (
                    <Money amount={regular} />
                  )}
                </span>
              </p>
            )}
            {quote && (
              <p className="lib-bb-note lib-muted">
                {localized(locale, "Offer price. The discount is applied automatically in your bag.", "ده سعر العرض، والخصم بيتحسب تلقائي في السلة.")}
              </p>
            )}
            {picks.length === count && !lines && (
              <p className="lib-bb-note">{localized(locale, "Choose an option for each product.", "اختار النوع لكل منتج.")}</p>
            )}
            <button type="button" className="lib-bb-add" disabled={!lines || adding} aria-busy={adding} onClick={addAll}>
              {adding ? localized(locale, "Adding…", "بنضيف…") : buttonText}
            </button>
            <p className={status.kind === "error" ? "lib-bb-msg is-error" : "lib-bb-msg"} role="status" aria-live="polite">
              {status.kind === "error" && status.text}
              {status.kind === "done" && (
                <>
                  {localized(locale, "Added to your bag.", "الباقة اتضافت للسلة.")}
                  {savedAmount > 0 && (
                    <>
                      {localized(locale, " You saved ", " وفّرت ")}
                      <span dir="ltr">
                        <Money amount={savedAmount} />
                      </span>
                    </>
                  )}
                </>
              )}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
