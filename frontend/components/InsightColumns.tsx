"use client";

import { total } from "modules/insights";
import { useFormatter } from "next-intl";
import { CSSProperties, FC } from "react";
import InsightAxis from "./InsightAxis";
import InsightLegend from "./InsightLegend";
import InsightTable, { type Row } from "./InsightTable";

/**
 * One column, a year or a decade: a row of the table of counts, with the
 * column's year, or the first year of its decade, in `at`.
 */
type Column = Row & { at: number };

type Props = {
  /** The caption of the table of counts, which is the title of the chart. */
  title: string;
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
 * A column chart with one column for each year or decade in `columns`. Each
 * column stacks its series from the bottom, and its height is the sum of its
 * counts as a fraction of the largest sum, which is written at the top of the
 * chart. With `shares`, every column is full height, and each series takes its
 * share of the column's sum. The chart is drawn on an `InsightAxis`, which
 * labels the columns.
 *
 * Hovering a column shows its label, its total, and its count in each series
 * where that count is above 0, with its share when `shares` is set. The chart
 * is hidden from assistive technology, which reads a table of the same counts
 * instead.
 */
const InsightColumns: FC<Props> = ({
  title,
  heading,
  series,
  columns,
  shares = false,
}) => {
  const format = useFormatter();
  const most = Math.max(1, ...columns.map(({ counts }) => total(counts)));
  // Returns the count that fills a column with `counts`: the largest sum, or
  // with `shares`, the column's own sum.
  const scale = (counts: number[]) =>
    shares ? Math.max(1, total(counts)) : most;

  return (
    <div className="space-y-3">
      {series.length > 1 ? <InsightLegend series={series} /> : null}
      <InsightAxis
        ats={columns.map(({ at }) => at)}
        top={
          shares ? format.number(1, { style: "percent" }) : format.number(most)
        }
        spaced
      >
        <div className="flex gap-px items-end h-full">
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
                          {shares
                            ? ` · ${format.number(counts[which] / scale(counts), { style: "percent" })}`
                            : ""}
                        </span>
                      ) : null,
                    )
                  : null}
              </span>
            </div>
          ))}
        </div>
      </InsightAxis>
      <InsightTable
        title={title}
        heading={heading}
        series={series}
        rows={columns}
      />
    </div>
  );
};

export default InsightColumns;
export type { Column };
