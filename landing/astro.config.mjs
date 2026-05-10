import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Build a slug → lastmod map from blog frontmatter at build time.
// Sitemap integration runs before content collections are queryable, so we
// read the markdown files directly from disk and parse the frontmatter dates.
function buildBlogLastmodMap() {
  const map = new Map();
  const blogDir = "./src/content/blog";
  try {
    for (const file of readdirSync(blogDir)) {
      if (!file.endsWith(".md")) continue;
      const slug = file.replace(/\.md$/, "");
      const raw = readFileSync(join(blogDir, file), "utf-8");
      const fm = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!fm) continue;
      const updated = fm[1].match(/^updatedAt:\s*['"]?([^'"\n]+)['"]?/m);
      const published = fm[1].match(/^publishedAt:\s*['"]?([^'"\n]+)['"]?/m);
      const date = updated?.[1] || published?.[1];
      if (date) map.set(slug, new Date(date).toISOString());
    }
  } catch {
    /* directory missing in some build contexts — fall back to build date */
  }
  return map;
}

const BLOG_LASTMOD = buildBlogLastmodMap();
const BUILD_DATE = new Date().toISOString();

// Static page priorities. Anything not listed gets 0.5 (sitemap default).
const PAGE_PRIORITY = {
  "/": 1.0,
  "/blog/": 0.8,
  "/cookies/": 0.3,
  "/privacidad/": 0.3,
  "/terminos/": 0.3,
};

const PAGE_CHANGEFREQ = {
  "/": "weekly",
  "/blog/": "weekly",
  "/cookies/": "yearly",
  "/privacidad/": "yearly",
  "/terminos/": "yearly",
};

export default defineConfig({
  site: "https://clear-book.com",
  output: "static",
  trailingSlash: "always",
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/form"),
      serialize(item) {
        const url = new URL(item.url);
        const path = url.pathname;

        // Blog posts: /blog/{slug}/ → look up frontmatter date
        const blogMatch = path.match(/^\/blog\/([^/]+)\/$/);
        if (blogMatch) {
          const slug = blogMatch[1];
          const lastmod = BLOG_LASTMOD.get(slug);
          return {
            ...item,
            lastmod: lastmod || BUILD_DATE,
            changefreq: "monthly",
            priority: 0.7,
          };
        }

        // Static pages: use build date + per-page priority
        return {
          ...item,
          lastmod: BUILD_DATE,
          changefreq: PAGE_CHANGEFREQ[path] || "monthly",
          priority: PAGE_PRIORITY[path] ?? 0.5,
        };
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  i18n: {
    defaultLocale: "es",
    locales: ["es"],
  },
});
