"use client";

import type { Insights } from "modules/insights";
import { useFormatter, useTranslations } from "next-intl";
import { FC } from "react";

/**
 * The main figures for a set of publications: how many there are, how many
 * distinct works and names they contain, the years they cover, and how many
 * cite a source.
 *
 * Each figure is a `dt` and `dd` pair in a description list. The value is
 * displayed above its term but comes after it in the markup, so it is read
 * after the term.
 */
const InsightFigures: FC<{ insights: Insights }> = ({ insights }) => {
  const t = useTranslations("insights");
  const format = useFormatter();
  const { totals, years } = insights;

  const figures = [
    { key: "publications", value: format.number(insights.publications) },
    { key: "works", value: format.number(totals.works) },
    { key: "originalAuthors", value: format.number(totals.originalAuthors) },
    { key: "translators", value: format.number(totals.translators) },
    { key: "publishers", value: format.number(totals.publishers) },
    { key: "countries", value: format.number(totals.countries) },
    {
      key: "years",
      // Years are passed as strings so they are not formatted with grouping.
      value: years
        ? t("span", { first: String(years.first), last: String(years.last) })
        : "—",
    },
    {
      key: "sourced",
      value: t("sourcedOf", {
        sourced: format.number(insights.sourced),
        publications: format.number(insights.publications),
      }),
    },
  ] as const;

  return (
    <section aria-label={t("figures")}>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-gray-200 bg-gray-200 sm:grid-cols-4">
        {figures.map(({ key, value }) => (
          <div key={key} className="flex flex-col-reverse gap-1 p-3 bg-white">
            <dt className="text-xs text-gray-600">{t(key)}</dt>
            <dd className="text-2xl text-gray-900 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default InsightFigures;
