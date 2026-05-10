import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return rss({
    title: "Clearbook Blog",
    description:
      "Guías, novedades y buenas prácticas para estudios contables en Perú.",
    site: context.site,
    items: posts
      .sort(
        (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
      )
      .map((post) => ({
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.publishedAt,
        link: `/blog/${post.id}/`,
      })),
    customData: "<language>es-PE</language>",
  });
}
