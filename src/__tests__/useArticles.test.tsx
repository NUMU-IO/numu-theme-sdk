/**
 * Unit tests for the blog/article hooks — page.data plumbing for the
 * blogs/blog/article templates.
 *
 * Uses React.createElement (no JSX) so the test transpiles without any
 * JSX-runtime config, matching the SDK's no-build test setup.
 */

import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  useArticle,
  useArticles,
  useBlog,
  useBlogs,
} from "../hooks/useArticles";
import { PageContext } from "../contexts";
import type { Page } from "../types/entities";

function wrapper(page: Page | null) {
  return ({ children }: { children: ReactNode }) =>
    createElement(PageContext.Provider, { value: page }, children);
}

const blog = { handle: "news", title: { en: "News", ar: "الأخبار" } };
const articles = [
  {
    handle: "hello",
    title: { en: "Hello", ar: "مرحبا" },
    published_at: "2026-07-21T00:00:00Z",
  },
];
const article = {
  ...articles[0],
  body: { en: "<p>Body</p>", ar: "<p>نص</p>" },
  blog,
};

describe("blog/article hooks", () => {
  it("useBlogs reads page.data.blogs on the blogs template", () => {
    const { result } = renderHook(() => useBlogs(), {
      wrapper: wrapper({ type: "blogs", title: "Blog", data: { blogs: [blog] } }),
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.title.ar).toBe("الأخبار");
  });

  it("useBlog + useArticles read the blog template's data", () => {
    const page: Page = {
      type: "blog",
      title: "News",
      data: { blog, articles },
    };
    const { result: b } = renderHook(() => useBlog(), { wrapper: wrapper(page) });
    const { result: a } = renderHook(() => useArticles(), {
      wrapper: wrapper(page),
    });
    expect(b.current?.handle).toBe("news");
    expect(a.current).toHaveLength(1);
  });

  it("useArticle reads the article template; useBlog falls back to article.blog", () => {
    const page: Page = {
      type: "article",
      title: "Hello",
      data: { article, blog_handle: "news" },
    };
    const { result: a } = renderHook(() => useArticle(), {
      wrapper: wrapper(page),
    });
    const { result: b } = renderHook(() => useBlog(), { wrapper: wrapper(page) });
    expect(a.current?.body?.en).toBe("<p>Body</p>");
    expect(b.current?.handle).toBe("news");
  });

  it("all hooks degrade outside their template — never throw", () => {
    const page: Page = { type: "home", title: "Home" };
    expect(
      renderHook(() => useBlogs(), { wrapper: wrapper(page) }).result.current,
    ).toEqual([]);
    expect(
      renderHook(() => useArticles(), { wrapper: wrapper(page) }).result.current,
    ).toEqual([]);
    expect(
      renderHook(() => useArticle(), { wrapper: wrapper(page) }).result.current,
    ).toBeNull();
    expect(
      renderHook(() => useBlog(), { wrapper: wrapper(null) }).result.current,
    ).toBeNull();
  });
});
