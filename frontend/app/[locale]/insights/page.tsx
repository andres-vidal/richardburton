import { routing } from "i18n/routing";
import Insights, { InsightsHeading } from "components/Insights";
import Layout from "components/Layout";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { readNumericCodes } from "app/countries/read";
import { readInsights } from "app/insights/read";
import { worldMap } from "modules/world-map";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "insights" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/insights`,
      languages: Object.fromEntries(
        routing.locales.map((other) => [other, `/${other}/insights`]),
      ),
    },
  };
}

/**
 * The insights page. It fetches the counts for every publication, or for the
 * ones the `search` query parameter matches, and renders them with `Insights`
 * under an `InsightsHeading`. The outlines of the world map are computed here,
 * on the server, so the map's libraries and outline data are not sent to the
 * browser. The map names its countries with the numeric codes in the server's
 * country list, which the page's country names are read from too.
 *
 * It fills the width of the page like the index page, so the summary line, the
 * links to the two views and the search box stay in place when switching
 * between the list and the insights.
 *
 * The page is wrapped in `Suspense` because `InsightsHeading` calls
 * `useSearchParams()`. The index page is wrapped for the same reason.
 */
export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  const [{ locale }, { search }] = await Promise.all([params, searchParams]);
  const [insights, codes] = await Promise.all([
    readInsights(search),
    readNumericCodes(locale),
  ]);

  return (
    <Suspense>
      <Layout
        subheader={<InsightsHeading insights={insights} />}
        content={<Insights insights={insights} map={worldMap(codes)} />}
      />
    </Suspense>
  );
}
