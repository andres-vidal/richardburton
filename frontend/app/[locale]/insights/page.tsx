import { routing } from "i18n/routing";
import Insights, { InsightsHeading } from "components/Insights";
import Layout from "components/Layout";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { readInsights } from "app/insights/read";

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
 * under an `InsightsHeading`. The outlines of the world map come from the
 * layout.
 *
 * It fills the width of the page like the index page, so the summary line, the
 * links to the two views and the search box stay in place when switching
 * between the list and the insights.
 *
 * The page is wrapped in `Suspense` because `InsightsHeading` calls
 * `useSearchParams()`. The index page is wrapped for the same reason.
 */
export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const insights = await readInsights(search);

  return (
    <Suspense>
      <Layout
        subheader={<InsightsHeading insights={insights} />}
        content={<Insights insights={insights} />}
      />
    </Suspense>
  );
}
