import Insights, { InsightsHeading } from "components/Insights";
import Layout from "components/Layout";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { alternates } from "app/alternates";
import { readInsights } from "app/insights/read";
import { chartParams, parseDescription } from "modules/chart";

/** Returns the page's title, its description and its address in every locale. */
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
    alternates: alternates("/insights", locale),
  };
}

/**
 * The insights page. It reads the chart from the query parameters with
 * `parseDescription`, fetches the counts and the chart for every publication,
 * or for the ones the `search` query parameter matches, and renders them with
 * `Insights` under an `InsightsHeading`. The outlines of the world map come
 * from the layout.
 *
 * The heading is part of the content rather than the layout's subheader, so it
 * scrolls away with the page and leaves room for the chart. The chart's
 * toolbar is pinned under the header instead.
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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search : undefined;
  const description = parseDescription(params);
  const insights = await readInsights(search, chartParams(description));

  return (
    <Suspense>
      <Layout
        content={
          <>
            <InsightsHeading insights={insights} />
            <Insights insights={insights} description={description} />
          </>
        }
      />
    </Suspense>
  );
}
