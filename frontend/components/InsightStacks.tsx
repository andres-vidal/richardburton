"use client";

import { total } from "modules/insights";
import { useFormatter } from "next-intl";
import { CSSProperties, FC } from "react";
import InsightLegend from "./InsightLegend";
import InsightSection from "./InsightSection";
import InsightTable, { type Row } from "./InsightTable";

type Props = {
  title: string;
  /** What the chart shows, in a tooltip beside the title. */
  hint?: string;
  /** The heading of the table's first column, such as "Decade". */
  heading: string;
  /** The name of each series, in the order they are stacked from the left. */
  series: string[];
  /** The rows, such as decades, each with its count in each series. */
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
  const format = useFormatter();
  const most = Math.max(1, ...rows.map(({ counts }) => total(counts)));

  return (
    <InsightSection title={title} hint={hint}>
      <InsightLegend series={series} />
      <ol aria-hidden className="space-y-2">
        {rows.map(({ key, label, counts }) => (
          <li
            key={key}
            className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-baseline text-sm"
          >
            <span className="text-gray-900">{label}</span>
            <span className="text-gray-700 tabular-nums">
              {format.number(total(counts))}
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
            <span className="right-0 chart-tip">
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
    </InsightSection>
  );
};

export default InsightStacks;
