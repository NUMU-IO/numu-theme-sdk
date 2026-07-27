import { useContext } from "react";
import { PageContext } from "../contexts";
import type {
  ArticleDetail,
  ArticleSummary,
  BlogSummary,
} from "../types/entities";

/**
 * Blog/article hooks — read the content the host resolves server-side
 * into the page descriptor:
 *
 *   `blogs` template   → `page.data.blogs`              → useBlogs()
 *   `blog` template    → `page.data.blog` + `.articles` → useBlog() / useArticles()
 *   `article` template → `page.data.article`            → useArticle()
 *
 * All of them degrade to `[]` / `null` outside their template (or on a
 * store with no blog content) — never throw, so a section can render its
 * empty state. Text fields are bilingual maps; the body is UN-sanitized
 * merchant HTML — render via `<RichText>`.
 */

function pageData(): Record<string, unknown> | undefined {
  // A hook in all but name; isolated so each public hook stays a plain
  // one-liner over the same context read.
  return useContext(PageContext)?.data;
}

/** Published blogs of the store (blogs-index template). */
export function useBlogs(): BlogSummary[] {
  const data = pageData();
  const blogs = data?.blogs;
  return Array.isArray(blogs) ? (blogs as BlogSummary[]) : [];
}

/** The current blog (blog template), or the article's blog on an article page. */
export function useBlog(): BlogSummary | null {
  const data = pageData();
  const blog = data?.blog ?? (data?.article as ArticleDetail | undefined)?.blog;
  return blog && typeof blog === "object" ? (blog as BlogSummary) : null;
}

/** Published articles of the current blog (blog template), newest first. */
export function useArticles(): ArticleSummary[] {
  const data = pageData();
  const articles = data?.articles;
  return Array.isArray(articles) ? (articles as ArticleSummary[]) : [];
}

/** The current article (article template). */
export function useArticle(): ArticleDetail | null {
  const data = pageData();
  const article = data?.article;
  return article && typeof article === "object"
    ? (article as ArticleDetail)
    : null;
}
