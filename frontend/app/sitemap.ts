import { routing } from "i18n/routing";
import type { MetadataRoute } from "next";
import { appUrl } from "modules/app-url";
import { readIndex } from "./publications/read";

/** One entry per locale, each naming the others so they read as translations. */
function entry(path: string, priority: number): MetadataRoute.Sitemap {
  const base = appUrl();

  return routing.locales.map((locale) => ({
    url: `${base}/${locale}${path}`,
    priority,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((other) => [other, `${base}/${other}${path}`]),
      ),
    },
  }));
}

/**
 * Every page worth finding from outside: the database itself and each
 * publication in it.
 *
 * A record is only reachable by following a row, so without this a crawler gets
 * the front page and nothing else.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { order } = await readIndex();

  return [
    ...entry("", 1),
    ...order.flatMap((id) => entry(`/publications/${id}`, 0.8)),
  ];
}
