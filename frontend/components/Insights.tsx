"use client";

import type { Counted, Insights as Described } from "modules/insights";
import { useCountryNaming } from "modules/country-names";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { FC } from "react";
import DatabaseSummary from "./DatabaseSummary";
import InsightBars from "./InsightBars";
import InsightFigures from "./InsightFigures";
import PageHeader from "./PageHeader";
import PublicationSearch from "./PublicationSearch";
import { SearchHelpModal } from "./SearchHelpModal";

type Props = { insights: Described };

/**
 * The subheader of the insights page: the number of publications counted, the
 * links to the two views of the database, and the search box that filters what
 * is counted.
 */
const InsightsHeading: FC<Props> = ({ insights }) => {
  const t = useTranslations("home");
  const search = useSearchParams()?.get("search");
  const count = insights.publications;

  return (
    <div className="py-4 space-y-4">
      <DatabaseSummary
        view="insights"
        summary={search ? t("matching", { count }) : t("count", { count })}
      />
      <PublicationSearch matched={insights.matched ?? []} />
      <SearchHelpModal />
    </div>
  );
};

/**
 * The content of the insights page: the main figures, the publications per
 * decade, the names with the most publications in each field, the countries of
 * publication, and the works translated more than once.
 *
 * When there are no publications to count, it shows a message instead of the
 * figures and lists. The list of works translated more than once is left out
 * when it is empty.
 */
const Insights: FC<Props> = ({ insights }) => {
  const t = useTranslations("insights");
  const naming = useCountryNaming();
  const format = useFormatter();

  const counted = (names: Counted[]) =>
    names.map(({ name, count }) => ({
      key: name,
      label: name,
      count,
      value: format.number(count),
    }));

  return (
    <div className="pb-8 space-y-8">
      <PageHeader title={t("title")} description={t("description")} />
      {insights.publications === 0 ? (
        <p className="text-gray-600">{t("nothing")}</p>
      ) : (
        <>
          <InsightFigures insights={insights} />
          <div className="grid gap-10 md:grid-cols-2">
            <InsightBars
              title={t("byDecade")}
              bars={insights.decades.map(({ decade, count }) => ({
                key: String(decade),
                label: t("decade", { decade: String(decade) }),
                count,
                value: format.number(count),
              }))}
            />
            <InsightBars
              title={t("leadingAuthors")}
              bars={counted(insights.originalAuthors)}
            />
            <InsightBars
              title={t("leadingTranslators")}
              bars={counted(insights.translators)}
            />
            <InsightBars
              title={t("leadingPublishers")}
              bars={counted(insights.publishers)}
            />
            <InsightBars
              title={t("countriesOfPublication")}
              bars={insights.countries.map(({ code, count }) => ({
                key: code,
                label: naming.name(code),
                count,
                value: format.number(count),
              }))}
            />
            {insights.retranslated.length > 0 && (
              <InsightBars
                title={t("retranslated")}
                bars={insights.retranslated.map(
                  ({ title, authors, translations }) => ({
                    key: `${title} · ${authors.join(", ")}`,
                    label: title,
                    detail: authors.join(", "),
                    count: translations,
                    value: t("translations", { count: translations }),
                  }),
                )}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Insights;
export { InsightsHeading };
