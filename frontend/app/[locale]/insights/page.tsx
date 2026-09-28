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
 * The insights into the database: every publication in it counted, or the
 * ones the search in the address matches.
 *
 * Suspense-wrapped because the heading reads `useSearchParams()`, as the index
 * does.
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
        measure="aligned"
        subheader={<InsightsHeading insights={insights} />}
        content={<Insights insights={insights} />}
      />
    </Suspense>
  );
}
