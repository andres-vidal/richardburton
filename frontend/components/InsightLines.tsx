"use client";

import { tickOf, total } from "modules/insights";
import { useFormatter } from "next-intl";
import { CSSProperties, FC, ReactNode } from "react";
import type { Column } from "./InsightColumns";
import InsightLegend from "./InsightLegend";
import InsightSection from "./InsightSection";
import InsightTable from "./InsightTable";

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
  /** Every year or decade to draw, in order. */
  points: Column[];
  /** Whether the series are stacked as areas, rather than drawn as lines. */
  stacked?: boolean;
};

/**
 * A titled line chart over the years or decades in `points`, with one line
 * for each series. With `stacked`, each series is an area stacked on the ones
 * before it, so the top of the last area is the sum of the counts. The largest
 * value drawn is written at the top of the chart.
 *
 * The axis is labelled like `InsightColumns`: years divisible by 20, and the
 * other decades on wider screens.
 *
 * Hovering anywhere above a point draws a vertical line through it and dots
 * where it meets each series, and shows the point's label, its total and its
 * count in each series. The chart is hidden from assistive technology, which
 * reads a table of the same counts instead.
 */
const InsightLines: FC<Props> = ({
  title,
  hint,
  actions,
  heading,
  series,
  points,
  stacked = false,
}) => {
  const format = useFormatter();

  // The height of each series at each point: its count, or with `stacked`, the
  // sum of its count and the counts of the series before it.
  const tops = points.map(({ counts }) =>
    counts.map((count, which) =>
      stacked ? total(counts.slice(0, which + 1)) : count,
    ),
  );
  const most = Math.max(1, ...tops.flat());
  const y = (value: number) => 100 - (value / most) * 100;
  const line = (which: number) =>
    tops.map((heights, index) => `${index + 0.5},${y(heights[which])}`);

  return (
    <InsightSection title={title} hint={hint} actions={actions}>
      {series.length > 1 ? <InsightLegend series={series} /> : null}
      <div aria-hidden className="pt-5">
        <div className="relative h-48 border-b border-gray-300">
          <span className="absolute inset-x-0 top-0 border-t border-dashed border-gray-300" />
          <span className="absolute left-0 -top-5 text-xs text-gray-600 tabular-nums">
            {format.number(most)}
          </span>
          <svg
            viewBox={`0 0 ${points.length} 100`}
            preserveAspectRatio="none"
            className="absolute inset-0 overflow-visible size-full"
          >
            {series.map((name, which) =>
              stacked ? (
                <polygon
                  key={name}
                  data-series={which}
                  points={[
                    ...line(which),
                    ...(which > 0
                      ? line(which - 1).reverse()
                      : [`${points.length - 0.5},100`, "0.5,100"]),
                  ].join(" ")}
                  vectorEffect="non-scaling-stroke"
                  className="fill-series stroke-white stroke-1"
                />
              ) : (
                <polyline
                  key={name}
                  data-series={which}
                  points={line(which).join(" ")}
                  vectorEffect="non-scaling-stroke"
                  className="fill-none stroke-series stroke-2 [stroke-linejoin:round]"
                />
              ),
            )}
          </svg>
          <div className="absolute inset-0 flex">
            {points.map(({ at, label, counts }, index) => (
              <div key={at} className="group relative flex-1 min-w-0">
                <span className="hidden absolute inset-y-0 left-1/2 w-px bg-gray-400 group-hover:block" />
                {tops[index].map((height, which) => (
                  <span
                    key={which}
                    data-series={which}
                    style={{ "--height": height / most } as CSSProperties}
                    className="hidden absolute left-1/2 rounded-full ring-2 ring-white -translate-x-1/2 translate-y-1/2 size-2 bottom-[calc(var(--height)*100%)] bg-series group-hover:block"
                  />
                ))}
                <span className="chart-tip absolute-center-x">
                  {label} · {format.number(total(counts))}
                  {series.length > 1
                    ? series.map((name, which) =>
                        counts[which] ? (
                          <span key={name} className="block text-gray-300">
                            {name} {format.number(counts[which])}
                          </span>
                        ) : null,
                      )
                    : null}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex h-5">
          {points.map(({ at }) => (
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
        rows={points.map(({ at, label, counts }) => ({
          key: String(at),
          label,
          counts,
        }))}
      />
    </InsightSection>
  );
};

export default InsightLines;
