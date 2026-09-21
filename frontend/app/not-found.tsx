import Document from "app/document";
import type { Locale } from "i18n/routing";
import { getLocale } from "next-intl/server";
import NotFound from "./[locale]/not-found";

/**
 * The 404 for a URL that matched no route at all, which Next renders here at
 * the root rather than inside the locale segment.
 *
 * There is no `locale` param to read this high up, so the locale comes from the
 * request configuration, which the proxy has already settled. A URL under `/pt`
 * is answered in Portuguese even though no route matched it.
 */
export default async function RootNotFound() {
  const locale = await getLocale();

  return (
    <Document locale={locale as Locale}>
      <NotFound />
    </Document>
  );
}
