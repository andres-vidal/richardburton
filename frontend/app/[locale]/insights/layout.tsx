import { readNumericCodes } from "app/countries/read";
import { worldMap } from "modules/world-map";
import { WorldMapProvider } from "modules/world-map-provider";
import type { ReactNode } from "react";

/**
 * The layout of the insights page. It computes the outlines of the world map
 * on the server, naming each country with the numeric codes in the server's
 * country list, and provides them to the page with `WorldMapProvider`. The
 * map's libraries and outline data are therefore not sent to the browser.
 *
 * A layout is not rendered again when only the search in the address changes,
 * so the outlines are sent once when the page is opened, not with every
 * search.
 */
export default async function InsightsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const codes = await readNumericCodes(locale);

  return <WorldMapProvider map={worldMap(codes)}>{children}</WorldMapProvider>;
}
