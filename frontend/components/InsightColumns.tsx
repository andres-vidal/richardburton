"use client";

import { useFormatter } from "next-intl";
import { CSSProperties, FC, useId } from "react";
import InsightLegend from "./InsightLegend";
import InsightTable from "./InsightTable";
import InsightTitle from "./InsightTitle";

/** One column of the chart, such as a year. */
type Column = {
  key: string;
  /** The column's name, such as a year. It is shown on hover and in the table. */
  label: string;
  /** The count of each series, in the order of `series`. */
  counts: number[];
  /**
   * Whether the column's label is written under the chart. `major` labels are
   * always written, and `minor` labels only on wider screens.
   */
  tick?: "major" | "minor";
};

type Props = {
  title: string;
  /** What the chart shows, in a tooltip beside the title. */
  hint?: string;
  /** The heading of the table's first column, such as "Year". */
  heading: string;
  /** The name of each series, in the order they are stacked from the bottom. */
  series: string[];
  columns: Column[];
};

/**
 * A titled column chart, with one column for each entry in `columns`. Each
 * column stacks its series from the bottom, and its height is its total as a
 * fraction of the largest total. The largest total is written at the top of
 * the chart.
 *
 * Hovering a column shows its label, its total, and its count in each series
 * where that count is above 0. Labels are written under the columns marked
 * with a `tick`, and a label under the first or last column is aligned
 * inwards, so it stays inside the chart. The chart is hidden from assistive
 * technology, which reads a table of the same counts instead.
 */
const InsightColumns: FC<Props> = ({
  title,
  hint,
  heading,
  series,
  columns,
}) => {
  const id = useId();
  const format = useFormatter();

  const totals = columns.map(({ counts }) => counts.reduce((a, b) => a + b, 0));
  const most = Math.max(1, ...totals);

  return (
    <section aria-labelledby={id} className="space-y-3">
      <InsightTitle id={id} title={title} hint={hint} />
      <InsightLegend series={series} />
      <div aria-hidden className="pt-5">
        <div className="relative flex gap-px items-end h-48 border-b border-gray-300">
          <span className="absolute inset-x-0 top-0 border-t border-dashed border-gray-300" />
          <span className="absolute left-0 -top-5 text-xs text-gray-600 tabular-nums">
            {format.number(most)}
          </span>
          {columns.map(({ key, label, counts }, index) => (
            <div
              key={key}
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
              <span className="hidden absolute bottom-full z-10 py-1 px-2 mb-1 text-xs text-white whitespace-nowrap bg-gray-900 rounded pointer-events-none group-hover:block absolute-center-x">
                {label} · {format.number(totals[index])}
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
          {columns.map(({ key, label, tick }, index) => (
            <span key={key} className="relative flex-1 min-w-0">
              <span
                data-tick={tick}
                data-edge={
                  index === 0
                    ? "start"
                    : index === columns.length - 1
                      ? "end"
                      : undefined
                }
                className="hidden absolute top-1 text-xs text-gray-600 tabular-nums data-[tick=major]:block md:data-[tick=minor]:block absolute-center-x data-[edge=start]:left-0 data-[edge=start]:translate-x-0 data-[edge=end]:left-auto data-[edge=end]:right-0 data-[edge=end]:translate-x-0"
              >
                {label}
              </span>
            </span>
          ))}
        </div>
      </div>
      <InsightTable
        title={title}
        heading={heading}
        series={series}
        rows={columns}
      />
    </section>
  );
};

export default InsightColumns;
export type { Column };
