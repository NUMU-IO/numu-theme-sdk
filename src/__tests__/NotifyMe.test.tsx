/**
 * NotifyMe — Back in Stock's form under a sold-out product's buy button.
 *
 * What must never break: the server markup equals the first client render
 * (the form is not lazy, so a mismatch would hydrate twice on every sold-out
 * PDP); one config request per page and only once the form shows; nothing at
 * all when the API says "not installed"; no POST from the theme editor; and
 * every state's copy, in Egyptian Arabic and English.
 */

import { act, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalizationContext, ShopContext, type LocalizationState } from "../contexts";
import { loadNotifyConfig, NotifyMe, resetNotifyConfig, subscribeNotify } from "../components/apps/NotifyMe";
import type { Product, ProductVariant, Store } from "../types/entities";

const SOLD_OUT = { id: "v-m", option_values: { Size: "M" }, is_in_stock: false } as ProductVariant;
const IN_STOCK = { id: "v-l", option_values: { Size: "L" }, is_in_stock: true } as ProductVariant;
const PRODUCT = { id: "p1", name: "Tee", in_stock: true, variants: [SOLD_OUT, IN_STOCK] } as unknown as Product;

function Providers({ locale = "en", children }: { locale?: string; children: ReactNode }) {
  const store = { id: "s1", installed_apps: [{ slug: "back-in-stock", settings: {} }] } as unknown as Store;
  const l10n = { locale, direction: locale === "ar" ? "rtl" : "ltr", translations: {} } as unknown as LocalizationState;
  return (
    <ShopContext.Provider value={store}>
      <LocalizationContext.Provider value={l10n}>{children}</LocalizationContext.Provider>
    </ShopContext.Provider>
  );
}

const ui = (variant: ProductVariant | null, locale = "en") => (
  <Providers locale={locale}>
    <NotifyMe product={PRODUCT} variant={variant} />
  </Providers>
);

/** fetch stub: config answers `config`, subscribe answers `subscribe`. */
function stubFetch({
  config = { status: 200, body: { contact: "phone_or_email" } as unknown },
  subscribe = { status: 200, body: { status: "subscribed" } as unknown },
} = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const r = url.endsWith("/config") ? config : subscribe;
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const calls = (fetchMock: ReturnType<typeof stubFetch>, suffix: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith(suffix));

async function submit(value: string) {
  // Re-query: the field is replaced when the config picks the email channel.
  await waitFor(() => expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(false));
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest("form")!);
}

beforeEach(() => {
  resetNotifyConfig();
  window.history.replaceState(null, "", "/products/tee");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NotifyMe", () => {
  it("renders nothing, and asks nothing, while the variant can be bought", () => {
    const fetchMock = stubFetch();
    const { container } = render(ui(IN_STOCK));
    expect(container.innerHTML).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("server markup: a labelled phone field, LTR, disabled until the config answers, plus the honeypot", () => {
    const html = renderToString(ui(SOLD_OUT));
    expect(html).toContain("Sold out — want a heads-up when it&#x27;s back?");
    expect(html).toMatch(/<label for="([^"]+)-contact" class="numu-notify-label">Mobile number \(WhatsApp\)<\/label>/);
    expect(html).toMatch(
      /<input id="[^"]+-contact" class="numu-notify-input" required="" dir="ltr" disabled="" type="tel" inputMode="tel" autoComplete="tel" maxLength="32" placeholder="01012345678" name="contact"\/>/,
    );
    expect(html).toContain('<input class="numu-notify-hp" type="text" tabindex="-1" autoComplete="off" aria-hidden="true" name="website"/>');
    expect(html).toContain('role="status" aria-live="polite"');
  });

  it("hydrates the server markup with no mismatch", async () => {
    stubFetch();
    const el = document.createElement("div");
    el.innerHTML = renderToString(ui(SOLD_OUT));
    document.body.appendChild(el);
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a) => errors.push(a.join(" ")));
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(el, ui(SOLD_OUT), {
        onRecoverableError: (e) => errors.push(String((e as Error)?.message ?? e)),
      });
    });
    spy.mockRestore();
    expect(errors).toEqual([]);
    await act(async () => root?.unmount());
    el.remove();
  });

  it("asks for the config once per page, however many forms and variant switches", async () => {
    const fetchMock = stubFetch();
    const { rerender } = render(
      <Providers>
        <NotifyMe product={PRODUCT} variant={SOLD_OUT} />
        <NotifyMe product={PRODUCT} variant={SOLD_OUT} />
      </Providers>,
    );
    await waitFor(() => expect((screen.getAllByRole("textbox")[0] as HTMLInputElement).disabled).toBe(false));
    rerender(ui(IN_STOCK));
    rerender(ui(SOLD_OUT));
    await waitFor(() => expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(false));
    expect(calls(fetchMock, "/api/apps/back-in-stock/config")).toHaveLength(1);
  });

  it.each([
    ["not installed", { status: 404, body: { detail: "not installed" } }],
    ["a server error", { status: 502, body: {} }],
    ["an unknown answer", { status: 200, body: { contact: "pigeon" } }],
  ])("removes itself on %s", async (_label, config) => {
    stubFetch({ config });
    const { container } = render(ui(SOLD_OUT));
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });

  it("an email-only store shows the email field and no switch", async () => {
    stubFetch({ config: { status: 200, body: { contact: "email" } } });
    render(ui(SOLD_OUT));
    const input = await screen.findByLabelText("Email");
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
    expect(input.getAttribute("type")).toBe("email");
    expect(input.getAttribute("autocomplete")).toBe("email");
    expect(screen.queryByRole("button", { name: /Prefer/ })).toBeNull();
  });

  it("a phone-only store hides the switch but keeps its row", async () => {
    stubFetch({ config: { status: 200, body: { contact: "phone" } } });
    const { container } = render(ui(SOLD_OUT));
    await waitFor(() => expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(false));
    expect(screen.queryByRole("button", { name: /Prefer/ })).toBeNull();
    expect(container.querySelector(".numu-notify-switch-row")).not.toBeNull();
  });

  it("posts the product, variant, phone, locale and honeypot through the host relay", async () => {
    const fetchMock = stubFetch();
    render(ui(SOLD_OUT, "ar"));
    await submit("01012345678");
    await screen.findByText("تمام، هنبلّغك أول ما يرجع.");
    const [url, init] = calls(fetchMock, "/subscribe")[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/apps/back-in-stock/subscribe");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      product_id: "p1",
      variant_id: "v-m",
      phone: "01012345678",
      locale: "ar",
      website: "",
    });
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("switches to email and posts the email", async () => {
    const fetchMock = stubFetch();
    render(ui(SOLD_OUT));
    await waitFor(() => expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Prefer email?" }));
    expect(screen.getByLabelText("Email").getAttribute("type")).toBe("email");
    expect(screen.getByRole("button", { name: "Prefer WhatsApp?" })).toBeTruthy();
    await submit("Mona@Example.com");
    await screen.findByText("Done — we'll tell you as soon as it's back.");
    expect(JSON.parse(String((calls(fetchMock, "/subscribe")[0][1] as RequestInit).body)).email).toBe("Mona@Example.com");
  });

  it("never posts from the theme editor, and says why", async () => {
    window.history.replaceState(null, "", "/products/tee?editor=1");
    const fetchMock = stubFetch();
    render(ui(SOLD_OUT, "ar"));
    await submit("01012345678");
    await screen.findByText("ده عرض بس — في المتجر الحقيقي الزرار بيسجّل الطلب.");
    expect(calls(fetchMock, "/subscribe")).toHaveLength(0);
  });

  it("an empty or blank field never posts and names the field", async () => {
    const fetchMock = stubFetch();
    render(ui(SOLD_OUT, "ar"));
    await submit("   ");
    await screen.findByText("اكتب رقم موبايل مصري صح، زي 01012345678");
    expect(calls(fetchMock, "/subscribe")).toHaveLength(0);
  });

  it("a 409 moves the shopper to the email field", async () => {
    stubFetch({ subscribe: { status: 409, body: { code: "channel_unavailable" } } });
    render(ui(SOLD_OUT));
    await submit("01012345678");
    await screen.findByText("WhatsApp alerts aren't available here — leave your email.");
    expect(screen.getByLabelText("Email").getAttribute("type")).toBe("email");
  });

  it("links a field error to the field", async () => {
    stubFetch({ subscribe: { status: 422, body: { code: "invalid_phone" } } });
    render(ui(SOLD_OUT));
    await submit("123");
    const status = await screen.findByText("Enter an Egyptian mobile number, like 01012345678");
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(status.id);
    expect(status.classList.contains("is-error")).toBe(true);
  });

  it.each([
    [200, { status: "subscribed" }, "Done — we'll tell you as soon as it's back.", "تمام، هنبلّغك أول ما يرجع."],
    [200, { status: "already" }, "You're already on the list.", "الرقم ده متسجّل قبل كده، هنبلّغك أول ما يرجع."],
    [200, { status: "available" }, "Good news — it's available now. Refresh to order.", "ده متاح دلوقتي! حدّث الصفحة واطلبه."],
    [422, { code: "invalid_phone" }, "Enter an Egyptian mobile number, like 01012345678", "اكتب رقم موبايل مصري صح، زي 01012345678"],
    [409, { code: "channel_unavailable" }, "WhatsApp alerts aren't available here — leave your email.", "التنبيه على واتساب مش متاح هنا، سيب إيميلك بدل كده."],
    [429, { code: "busy" }, "Too many requests — try again shortly.", "في ضغط دلوقتي، جرّب كمان شوية."],
    [500, {}, "Something went wrong — try again.", "حصلت مشكلة، جرّب تاني."],
  ])("HTTP %i %j shows its copy in both languages", async (status, body, en, ar) => {
    for (const [locale, text] of [["en", en], ["ar", ar]] as const) {
      resetNotifyConfig();
      stubFetch({ subscribe: { status, body } });
      const { unmount } = render(ui(SOLD_OUT, locale));
      await submit("01012345678");
      await screen.findByText(text);
      unmount();
    }
  });

  it("names the email in Arabic when an email is already on the list, and flags a bad email", async () => {
    stubFetch({ config: { status: 200, body: { contact: "email" } }, subscribe: { status: 200, body: { status: "already" } } });
    const first = render(ui(SOLD_OUT, "ar"));
    await submit("mona@example.com");
    await screen.findByText("الإيميل ده متسجّل قبل كده، هنبلّغك أول ما يرجع.");
    first.unmount();

    resetNotifyConfig();
    stubFetch({ config: { status: 200, body: { contact: "email" } }, subscribe: { status: 422, body: { code: "invalid_email" } } });
    render(ui(SOLD_OUT, "ar"));
    await submit("mona@");
    await screen.findByText("الإيميل ده مش مظبوط");
  });

  it("Arabic labels, button, switch and consent line", async () => {
    stubFetch();
    render(ui(SOLD_OUT, "ar"));
    expect(screen.getByText("خلص دلوقتي — نبلّغك أول ما يرجع؟")).toBeTruthy();
    expect(screen.getByLabelText("رقم الموبايل (واتساب)").getAttribute("dir")).toBe("ltr");
    expect(screen.getByRole("button", { name: "بلّغوني لما يرجع" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "عايز التنبيه على الإيميل؟" })).toBeTruthy();
    expect(screen.getByText("هنبعتلك رسالة واحدة بس لما ده يرجع.")).toBeTruthy();
  });

  it("shows the sending state while the request is out", async () => {
    let release: (r: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.endsWith("/config")
          ? Promise.resolve(new Response('{"contact":"phone_or_email"}'))
          : new Promise<Response>((r) => (release = r)),
      ),
    );
    render(ui(SOLD_OUT, "ar"));
    await submit("01012345678");
    expect((await screen.findByRole("button", { name: "ثانية…" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => release(new Response('{"status":"subscribed"}')));
  });
});

describe("loadNotifyConfig", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("asks again after a failure, so one bad moment does not hide the form for the page", async () => {
    resetNotifyConfig();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValue(new Response('{"contact":"email"}'));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadNotifyConfig()).toBeNull();
    expect(await loadNotifyConfig()).toBe("email");
    expect(await loadNotifyConfig()).toBe("email");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up on a hung request instead of leaving the form disabled", async () => {
    resetNotifyConfig();
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) =>
            init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
          ),
      ),
    );
    const answer = loadNotifyConfig();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await answer).toBeNull();
  });
});

describe("subscribeNotify", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    [200, { status: "subscribed" }, "subscribed"],
    [200, { status: "already" }, "already"],
    [200, { status: "available" }, "available"],
    [422, { code: "invalid_phone" }, "invalid_phone"],
    [422, { code: "invalid_email" }, "invalid_email"],
    [422, { code: "one_contact" }, "error"],
    [404, { detail: "not installed" }, "error"],
    [409, { code: "channel_unavailable" }, "channel_unavailable"],
    [429, { code: "busy" }, "busy"],
    [502, {}, "error"],
  ] as const)("maps HTTP %i %j to %s", async (status, body, result) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
    expect(await subscribeNotify({ product_id: "p1", phone: "010", locale: "en", website: "" })).toBe(result);
  });

  it("treats a network failure as an error, never as success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    expect(await subscribeNotify({ product_id: "p1", email: "a@b.co", locale: "ar", website: "" })).toBe("error");
  });
});
