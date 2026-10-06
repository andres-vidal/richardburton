"use client";

import { tickOf, total } from "modules/insights";
import { useFormatter } from "next-intl";
import { CSSProperties, FC } from "react";
import InsightLegend from "./InsightLegend";
import InsightSection from "./InsightSection";
import InsightTable from "./InsightTable";

type Props = {
  title: string;
  /** What the chart shows, in a tooltip beside the title. */
  hint?: string;
  /** The heading of the table's first column, such as "Year". */
  heading: string;
  /** The name of each series, in the order they are stacked from the bottom. */
  series: string[];
  /** Every year to draw, in order, with its count in each series. */
  years: { year: number; counts: number[] }[];
};

/**
 * A titled column chart with one column for each year in `years`. Each column
 * stacks its series from the bottom, and its height is its total as a fraction
 * of the largest total. The largest total is written at the top of the chart.
 *
 * Years divisible by 20 are labelled under the chart, and the other decades
 * too on wider screens (see `tickOf`). A label under the first or last column
 * is aligned inwards, so it stays inside the chart.
 *
 * Hovering a column shows its year, its total, and its count in each series
 * where that count is above 0. The chart is hidden from assistive technology,
 * which reads a table of the same counts instead.
 */
const InsightColumns: FC<Props> = ({ title, hint, heading, series, years }) => {
  const format = useFormatter();
  const most = Math.max(1, ...years.map(({ counts }) => total(counts)));

  return (
    <InsightSection title={title} hint={hint}>
      <InsightLegend series={series} />
      <div aria-hidden className="pt-5">
        <div className="relative flex gap-px items-end h-48 border-b border-gray-300">
          <span className="absolute inset-x-0 top-0 border-t border-dashed border-gray-300" />
          <span className="absolute left-0 -top-5 text-xs text-gray-600 tabular-nums">
            {format.number(most)}
          </span>
          {years.map(({ year, counts }) => (
            <div
              key={year}
              className="group relative flex flex-col-reverse flex-1 h-full min-w-0 hover:bg-indigo-50"
            >
              {counts.map((count, series) => (
                <span
                  key={series}
                  data-series={series}
                  style={{ "--share": count / most } as CSSProperties}
                  className="shrink-0 h-[calc(var(--share)*100%)] bg-series"
                />
              ))}
              <span className="chart-tip absolute-center-x">
                {year} · {format.number(total(counts))}
                {series.map((name, which) =>
                  counts[which] ? (
                    <span key={name} className="block text-gray-300">
                      {name} {format.number(counts[which])}
                    </span>
                  ) : null,
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-px h-5">
          {years.map(({ year }) => (
            <span key={year} className="relative flex-1 min-w-0 group/column">
              <span
                data-tick={tickOf(year)}
                className="hidden absolute top-1 text-xs text-gray-600 tabular-nums data-[tick=major]:block md:data-[tick=minor]:block absolute-center-x group-first/column:left-0 group-first/column:translate-x-0 group-last/column:left-auto group-last/column:right-0 group-last/column:translate-x-0"
              >
                {year}
              </span>
            </span>
          ))}
        </div>
      </div>
      <InsightTable
        title={title}
        heading={heading}
        series={series}
        rows={years.map(({ year, counts }) => ({
          key: String(year),
          label: String(year),
          counts,
        }))}
      />
    </InsightSection>
  );
};

export default InsightColumns;
