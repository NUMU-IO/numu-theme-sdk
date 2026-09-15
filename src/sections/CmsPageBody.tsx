/**
 * CmsPageBody — the merchant's page title and body from Online Store → Pages.
 *
 * On `/pages/<handle>` the host passes the page record in `page.data.page`.
 * A theme with no body binding of its own relies on the host portalling the
 * body into an EMPTY `<main>`. That breaks as soon as the merchant composes the
 * page from sections (a `page.<suffix>` variant): `<main>` is no longer empty,
 * so the text they wrote disappears. Rendering this first inside `<main>` keeps
 * the body on every page template, server-rendered.
 *
 * Renders nothing without a body: a lone title would fill `<main>` and hide the
 * host's "nothing here yet" fallback for an unwritten page.
 */

import { RichText } from "../components/RichText";
import { useLocale } from "../hooks/useLocalization";
import { usePage } from "../hooks/usePage";
import { BASE_CSS, LibStyle } from "./_shared";

const CSS = `
.lib-cms-page{padding-block:4rem}
.lib-cms-page .lib-container{max-inline-size:72ch}
.lib-cms-title{font-size:clamp(1.9rem,3.5vw,2.75rem);margin-block-end:1.5rem}
.lib-cms-body{line-height:1.75}
`;

interface CmsPageRecord {
  title?: string | null;
  body?: string | null;
  title_i18n?: Record<string, string> | null;
  body_i18n?: Record<string, string> | null;
}

export function CmsPageBody() {
  const page = usePage();
  const locale = useLocale();
  if (page?.type !== "page") return null;
  const cms = page.data?.page as CmsPageRecord | undefined;
  const body = cms?.body_i18n?.[locale] || cms?.body || "";
  if (!body.trim()) return null;
  // Not `page.title`: on PageContext that is the store name.
  const title = cms?.title_i18n?.[locale] || cms?.title || "";
  return (
    <section className="lib-section lib-cms-page">
      <LibStyle id="lib-base" css={BASE_CSS} />
      <LibStyle id="lib-cms-page" css={CSS} />
      <div className="lib-container">
        {title && <h1 className="lib-heading lib-cms-title">{title}</h1>}
        <RichText as="article" className="lib-cms-body" html={body} />
      </div>
    </section>
  );
}
