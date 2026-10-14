"use client";

import type { Description } from "modules/chart";
import type { Insights as Described } from "modules/insights";
import { useTranslations } from "next-intl";
import { FC } from "react";
import ChartBuilder from "./ChartBuilder";
import DatabaseSummary from "./DatabaseSummary";
import InsightFigures from "./InsightFigures";
import PageHeader from "./PageHeader";
import PublicationSearch from "./PublicationSearch";
import { SearchHelpModal } from "./SearchHelpModal";

type Props = { insights: Described };

/**
 * The heading of the insights page: the number of publications counted, the
 * links to the two views of the database, and the search box that filters what
 * is counted.
 */
const InsightsHeading: FC<Props> = ({ insights }) => (
  <div className="py-4 space-y-4">
    <DatabaseSummary view="insights" count={insights.publications} />
    <PublicationSearch matched={insights.matched ?? []} />
    <SearchHelpModal />
  </div>
);

/**
 * The content of the insights page: the main figures, and a chart that the
 * reader builds with `ChartBuilder`. `description` is the chart the page's
 * address describes, and `insights.chart` its counts.
 *
 * When there are no publications to count, it shows a message instead of the
 * figures and the chart.
 */
const Insights: FC<Props & { description: Description }> = ({
  insights,
  description,
}) => {
  const t = useTranslations("insights");

  return (
    <div className="pb-8 space-y-10">
      <PageHeader title={t("title")} />
      {insights.publications === 0 ? (
        <p className="text-gray-600">{t("nothing")}</p>
      ) : (
        <>
          <InsightFigures insights={insights} />
          <ChartBuilder description={description} drawn={insights.chart} />
        </>
      )}
    </div>
  );
};

export default Insights;
export { InsightsHeading };
