"use client";

import { total } from "modules/insights";
import { useFormatter } from "next-intl";
import { CSSProperties, FC } from "react";
import InsightAxis from "./InsightAxis";
import type { Column } from "./InsightColumns";
import InsightLegend from "./InsightLegend";
import InsightTable from "./InsightTable";

type Props = {
  /** The caption of the table of counts, which is the title of the chart. */
  title: string;
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
 * A line chart over the years or decades in `points`, with one line for each
 * series. With `stacked`, each series is an area stacked on the ones before
 * it, so the top of the last area is the sum of the counts. The largest value
 * drawn is written at the top of the chart. The chart is drawn on an
 * `InsightAxis`, which labels the points.
 *
 * Hovering anywhere above a point draws a vertical line through it and dots
 * where it meets each series, and shows the point's label, its total and its
 * count in each series. The chart is hidden from assistive technology, which
 * reads a table of the same counts instead.
 */
const InsightLines: FC<Props> = ({
  title,
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
  // Returns the y coordinate of `value` in the SVG's units: 100 at the bottom
  // for 0, and 0 at the top for the largest value drawn.
  const y = (value: number) => 100 - (value / most) * 100;
  // Returns the points of series `which`, one in the middle of each slot.
  const line = (which: number) =>
    tops.map((heights, index) => `${index + 0.5},${y(heights[which])}`);

  return (
    <div className="space-y-3">
      {series.length > 1 ? <InsightLegend series={series} /> : null}
      <InsightAxis ats={points.map(({ at }) => at)} top={format.number(most)}>
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
      </InsightAxis>
      <InsightTable
        title={title}
        heading={heading}
        series={series}
        rows={points}
      />
    </div>
  );
};

export default InsightLines;
