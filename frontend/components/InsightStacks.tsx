"use client";

import { useFormatter } from "next-intl";
import { CSSProperties, FC, useId } from "react";
import InsightLegend from "./InsightLegend";
import InsightTable from "./InsightTable";
import InsightTitle from "./InsightTitle";

/** One row of the chart, such as a decade. */
type Row = {
  key: string;
  /** The row's name, such as a decade. */
  label: string;
  /** The count of each series, in the order of `series`. */
  counts: number[];
};

type Props = {
  title: string;
  /** What the chart shows, in a tooltip beside the title. */
  hint?: string;
  /** The heading of the table's first column, such as "Decade". */
  heading: string;
  /** The name of each series, in the order they are stacked from the left. */
  series: string[];
  rows: Row[];
};

/**
 * A titled list of stacked bars, one for each entry in `rows`. Each row shows
 * its label and total above a grey track, and a bar on the track stacks the
 * row's series from the left. A bar's length is the row's total as a fraction
 * of the largest total, so a row with a total of 0 shows only the track.
 *
 * Hovering a row shows its count in each series. The bars are hidden from
 * assistive technology, which reads a table of the same counts instead.
 */
const InsightStacks: FC<Props> = ({ title, hint, heading, series, rows }) => {
  const id = useId();
  const format = useFormatter();

  const totals = rows.map(({ counts }) => counts.reduce((a, b) => a + b, 0));
  const most = Math.max(1, ...totals);

  return (
    <section aria-labelledby={id} className="space-y-3">
      <InsightTitle id={id} title={title} hint={hint} />
      <InsightLegend series={series} />
      <ol aria-hidden className="space-y-2">
        {rows.map(({ key, label, counts }, index) => (
          <li
            key={key}
            className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-baseline text-sm"
          >
            <span className="text-gray-900">{label}</span>
            <span className="text-gray-700 tabular-nums">
              {format.number(totals[index])}
            </span>
            <span className="flex overflow-hidden col-span-2 h-1.5 rounded-full bg-gray-200">
              {counts.map((count, series) => (
                <span
                  key={series}
                  data-series={series}
                  style={{ "--share": count / most } as CSSProperties}
                  className="shrink-0 h-full w-[calc(var(--share)*100%)] bg-series"
                />
              ))}
            </span>
            <span className="hidden absolute right-0 bottom-full z-10 py-1 px-2 text-xs text-white whitespace-nowrap bg-gray-900 rounded pointer-events-none group-hover:block">
              {series.map((name, which) => (
                <span key={name} className="block">
                  {name} {format.number(counts[which])}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
      <InsightTable
        title={title}
        heading={heading}
        series={series}
        rows={rows}
      />
    </section>
  );
};

export default InsightStacks;
export type { Row };
