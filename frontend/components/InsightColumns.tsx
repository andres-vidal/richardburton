"use client";

import { tickOf, total } from "modules/insights";
import { useFormatter } from "next-intl";
import { CSSProperties, FC, ReactNode } from "react";
import InsightLegend from "./InsightLegend";
import InsightSection from "./InsightSection";
import InsightTable from "./InsightTable";

/** One column, a year or a decade. */
type Column = {
  /** The column's year, or the first year of its decade. */
  at: number;
  /** How the column is named, such as "1950s". */
  label: string;
  /** The count of each series, in the order of `series`. */
  counts: number[];
};

type Props = {
  title: string;
  /** What the chart shows, in a tooltip beside the title. */
  hint?: string;
  /** Controls shown at the end of the title's row. */
  actions?: ReactNode;
  /** The heading of the table's first column, such as "Year". */
  heading: string;
  /** The name of each series, in the order they are stacked from the bottom. */
  series: string[];
  /** Every column to draw, in order. */
  columns: Column[];
  /**
   * Whether each column shows the share of each series in it, rather than the
   * counts.
   */
  shares?: boolean;
};

/**
 * A titled column chart with one column for each year or decade in `columns`.
 * Each column stacks its series from the bottom, and its height is the sum of
 * its counts as a fraction of the largest sum, which is written at the top of
 * the chart. With `shares`, every column is full height, and each series takes
 * its share of the column's sum.
 *
 * Years divisible by 20 are labelled under the chart, and the other decades
 * too on wider screens (see `tickOf`). A label under the first or last column
 * is aligned inwards, so it stays inside the chart.
 *
 * Hovering a column shows its label, its total, and its count in each series
 * where that count is above 0, with its share when `shares` is set. The chart
 * is hidden from assistive technology, which reads a table of the same counts
 * instead.
 */
const InsightColumns: FC<Props> = ({
  title,
  hint,
  actions,
  heading,
  series,
  columns,
  shares = false,
}) => {
  const format = useFormatter();
  const most = Math.max(1, ...columns.map(({ counts }) => total(counts)));
  const scale = (counts: number[]) =>
    shares ? Math.max(1, total(counts)) : most;
  const percent = (count: number, counts: number[]) =>
    format.number(count / Math.max(1, total(counts)), { style: "percent" });

  return (
    <InsightSection title={title} hint={hint} actions={actions}>
      {series.length > 1 ? <InsightLegend series={series} /> : null}
      <div aria-hidden className="pt-5">
        <div className="relative flex gap-px items-end h-48 border-b border-gray-300">
          <span className="absolute inset-x-0 top-0 border-t border-dashed border-gray-300" />
          <span className="absolute left-0 -top-5 text-xs text-gray-600 tabular-nums">
            {shares
              ? format.number(1, { style: "percent" })
              : format.number(most)}
          </span>
          {columns.map(({ at, label, counts }) => (
            <div
              key={at}
              className="group relative flex flex-col-reverse flex-1 h-full min-w-0 hover:bg-indigo-50"
            >
              {counts.map((count, which) => (
                <span
                  key={which}
                  data-series={which}
                  style={{ "--share": count / scale(counts) } as CSSProperties}
                  className="shrink-0 h-[calc(var(--share)*100%)] bg-series"
                />
              ))}
              <span className="chart-tip absolute-center-x">
                {label} · {format.number(total(counts))}
                {series.length > 1
                  ? series.map((name, which) =>
                      counts[which] ? (
                        <span key={name} className="block text-gray-300">
                          {name} {format.number(counts[which])}
                          {shares ? ` · ${percent(counts[which], counts)}` : ""}
                        </span>
                      ) : null,
                    )
                  : null}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-px h-5">
          {columns.map(({ at }) => (
            <span key={at} className="relative flex-1 min-w-0 group/column">
              <span
                data-tick={tickOf(at)}
                className="hidden absolute top-1 text-xs text-gray-600 tabular-nums data-[tick=major]:block md:data-[tick=minor]:block absolute-center-x group-first/column:left-0 group-first/column:translate-x-0 group-last/column:left-auto group-last/column:right-0 group-last/column:translate-x-0"
              >
                {at}
              </span>
            </span>
          ))}
        </div>
      </div>
      <InsightTable
        title={title}
        heading={heading}
        series={series}
        rows={columns.map(({ at, label, counts }) => ({
          key: String(at),
          label,
          counts,
        }))}
      />
    </InsightSection>
  );
};

export default InsightColumns;
export type { Column };
