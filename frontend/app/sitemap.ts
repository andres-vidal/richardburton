import { routing } from "i18n/routing";
import type { MetadataRoute } from "next";
import { readIndex } from "./publications/read";

const BASE = process.env.APP_URL ?? "http://localhost:3000";

/** One entry per locale, each naming the others so they read as translations. */
function entry(path: string, priority: number): MetadataRoute.Sitemap {
  return routing.locales.map((locale) => ({
    url: `${BASE}/${locale}${path}`,
    priority,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((other) => [other, `${BASE}/${other}${path}`]),
      ),
    },
  }));
}

/**
 * Every page worth finding from outside: the database itself and each
 * publication in it.
 *
 * A record is only reachable from the index by following a row, so without this
 * a crawler has the front page and nothing beyond it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { order } = await readIndex();

  return [
    ...entry("", 1),
    ...order.flatMap((id) => entry(`/publications/${id}`, 0.8)),
  ];
}
