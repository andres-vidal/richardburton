import { routing } from "i18n/routing";
import type { MetadataRoute } from "next";
import { appUrl } from "modules/app-url";
import { localized } from "./alternates";
import { readIndex } from "./publications/read";

// Returns one entry per locale for the page at `path`, each with `priority`
// and the absolute addresses of the page in every locale.
function entry(path: string, priority: number): MetadataRoute.Sitemap {
  const languages = localized(path, appUrl());

  return routing.locales.map((locale) => ({
    url: languages[locale],
    priority,
    alternates: { languages },
  }));
}

/**
 * Lists the pages a search engine should find: the database itself, the
 * insights page, and the page of each publication.
 *
 * A record is only reachable by following a row, so without this a crawler gets
 * the front page and nothing else.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { order } = await readIndex();

  return [
    ...entry("", 1),
    ...entry("/insights", 0.9),
    ...order.flatMap((id) => entry(`/publications/${id}`, 0.8)),
  ];
}
