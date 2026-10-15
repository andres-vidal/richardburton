"use client";

import { total } from "modules/insights";
import { useFormatter } from "next-intl";
import { CSSProperties, FC } from "react";
import InsightLegend from "./InsightLegend";
import InsightTable, { type Row } from "./InsightTable";

type Props = {
  /** The caption of the table of counts, which is the title of the chart. */
  title: string;
  /** The heading of the table's first column, such as "Decade". */
  heading: string;
  /** The name of each series, in the order they are stacked from the left. */
  series: string[];
  /** The rows, such as decades, each with its count in each series. */
  rows: Row[];
  /**
   * Whether each bar shows the share of each series in its row, rather than
   * the counts.
   */
  shares?: boolean;
};

/**
 * A list of stacked bars, one for each entry in `rows`. Each row shows its
 * label and total above a grey track, and a bar on the track stacks the row's
 * series from the left. A bar's length is the sum of the row's counts as a
 * fraction of the largest sum, so a row with no counts shows only the track.
 * With `shares`, every bar fills its track, and each series takes its share of
 * the row's sum.
 *
 * Hovering a row shows its count in each series, with its share when `shares`
 * is set. The bars are hidden from assistive technology, which reads a table
 * of the same counts instead.
 */
const InsightStacks: FC<Props> = ({
  title,
  heading,
  series,
  rows,
  shares = false,
}) => {
  const format = useFormatter();
  const most = Math.max(1, ...rows.map(({ counts }) => total(counts)));
  const scale = (counts: number[]) =>
    shares ? Math.max(1, total(counts)) : most;

  return (
    <div className="space-y-3">
      <InsightLegend series={series} />
      <ol aria-hidden className="space-y-2">
        {rows.map(({ key, label, detail, counts }) => (
          <li
            key={key}
            className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-baseline text-sm"
          >
            <span className="text-gray-900 break-words">
              {label}
              {detail ? (
                <span className="text-gray-600"> · {detail}</span>
              ) : null}
            </span>
            <span className="text-gray-700 tabular-nums">
              {format.number(total(counts))}
            </span>
            <span className="flex overflow-hidden col-span-2 h-1.5 rounded-full bg-gray-200">
              {counts.map((count, which) => (
                <span
                  key={which}
                  data-series={which}
                  style={{ "--share": count / scale(counts) } as CSSProperties}
                  className="shrink-0 h-full w-[calc(var(--share)*100%)] bg-series"
                />
              ))}
            </span>
            <span className="right-0 chart-tip">
              {series.map((name, which) => (
                <span key={name} className="block">
                  {name} {format.number(counts[which])}
                  {shares
                    ? ` · ${format.number(counts[which] / scale(counts), { style: "percent" })}`
                    : ""}
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
    </div>
  );
};

export default InsightStacks;
