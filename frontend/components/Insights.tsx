"use client";

import type { Counted, Insights as Described } from "modules/insights";
import type { WorldMap } from "modules/world-map";
import { useCountryNaming } from "modules/country-names";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { FC } from "react";
import DatabaseSummary from "./DatabaseSummary";
import InsightBars from "./InsightBars";
import InsightColumns from "./InsightColumns";
import InsightFigures from "./InsightFigures";
import InsightMap from "./InsightMap";
import InsightStacks from "./InsightStacks";
import InsightTimeline from "./InsightTimeline";
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
 * year by country, the publications per decade by kind, the most translated
 * authors, the authors first translated in each decade, the leading
 * translators with the years of their publications, the most frequent
 * author–translator pairs, the works translated more than once with the year
 * of each translation, the leading publishers, and the countries of
 * publication on a map drawn from `map`.
 *
 * When there are no publications to count, it shows a message instead of the
 * figures and charts. The works translated more than once are left out when
 * there are none.
 */
const Insights: FC<Props & { map: WorldMap }> = ({ insights, map }) => {
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
    <div className="pb-8 space-y-10">
      <PageHeader title={t("title")} />
      {insights.publications === 0 ? (
        <p className="text-gray-600">{t("nothing")}</p>
      ) : (
        <>
          <InsightFigures insights={insights} />
          <InsightColumns
            title={t("perYear")}
            hint={t("hints.perYear")}
            heading={t("year")}
            series={[
              ...insights.annual.countries.map((code) => naming.name(code)),
              t("elsewhere"),
            ]}
            columns={insights.annual.years.map(
              ({ year, counts, elsewhere }) => ({
                key: String(year),
                label: String(year),
                counts: [...counts, elsewhere],
                tick:
                  year % 20 === 0
                    ? "major"
                    : year % 10 === 0
                      ? "minor"
                      : undefined,
              }),
            )}
          />
          <div className="grid gap-10 md:grid-cols-2 md:grid-flow-row-dense xl:grid-cols-3">
            <InsightStacks
              title={t("byDecade")}
              hint={t("hints.byDecade")}
              heading={t("decadeHeading")}
              series={[
                t("firstTranslations"),
                t("retranslations"),
                t("reissues"),
              ]}
              rows={insights.decades.map(
                ({ decade, firstTranslations, retranslations, reissues }) => ({
                  key: String(decade),
                  label: t("decade", { decade: String(decade) }),
                  counts: [firstTranslations, retranslations, reissues],
                }),
              )}
            />
            <InsightBars
              title={t("leadingAuthors")}
              hint={t("hints.leadingAuthors")}
              bars={counted(insights.originalAuthors)}
            />
            <InsightBars
              title={t("debuts")}
              hint={t("hints.debuts")}
              bars={insights.debuts.map(({ decade, count }) => ({
                key: String(decade),
                label: t("decade", { decade: String(decade) }),
                count,
                value: format.number(count),
              }))}
            />
            <div className="md:col-span-2">
              <InsightTimeline
                title={t("leadingTranslators")}
                hint={t("hints.leadingTranslators")}
                tracks={insights.translators.map(({ name, count, years }) => ({
                  key: name,
                  label: name,
                  value: format.number(count),
                  marks: years.map(({ year, count }) => ({
                    year,
                    weight: count,
                    label: `${year} · ${t("publicationCount", { count })}`,
                  })),
                }))}
              />
            </div>
            <InsightBars
              title={t("pairs")}
              hint={t("hints.pairs")}
              bars={insights.pairs.map(({ author, translator, count }) => ({
                key: `${author} · ${translator}`,
                label: author,
                detail: translator,
                count,
                value: format.number(count),
              }))}
            />
            {insights.retranslated.length > 0 && (
              <div className="md:col-span-2">
                <InsightTimeline
                  title={t("retranslated")}
                  hint={t("hints.retranslated")}
                  tracks={insights.retranslated.map(
                    ({ title, authors, translations, timeline }) => ({
                      key: `${title} · ${authors.join(", ")}`,
                      label: title,
                      detail: authors.join(", "),
                      value: t("translations", { count: translations }),
                      marks: timeline.map(({ year, translators }) => ({
                        year,
                        label: `${year} · ${translators.join(", ")}`,
                      })),
                    }),
                  )}
                />
              </div>
            )}
            <InsightBars
              title={t("leadingPublishers")}
              hint={t("hints.leadingPublishers")}
              bars={counted(insights.publishers)}
            />
            <div className="md:col-span-2 xl:col-span-3">
              <InsightMap
                title={t("countriesOfPublication")}
                hint={t("hints.countriesOfPublication")}
                map={map}
                countries={insights.countries.map(({ code, count }) => ({
                  code,
                  name: naming.name(code),
                  count,
                }))}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Insights;
export { InsightsHeading };
