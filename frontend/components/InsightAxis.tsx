import { tickOf } from "modules/insights";
import { FC, ReactNode } from "react";

type Props = {
  /** The year of each slot, or the first year of its decade, in order. */
  ats: number[];
  /** The text at the top of the plot, such as the largest count drawn. */
  top: string;
  /** Whether the slots are one pixel apart, rather than side by side. */
  spaced?: boolean;
  /**
   * The plot. Its box is `h-48` tall, as wide as the axis, and positioned, so
   * a plot can fill it with `absolute inset-0`.
   */
  children: ReactNode;
};

/**
 * The axes of a chart over years or decades. The component renders a box for
 * the plot in `children`, with a dashed line along its top edge, `top` written
 * above that line, and a solid line along its bottom edge. Under the box, it
 * renders a row of equal slots, one for each year in `ats`, and writes the
 * year in the middle of its slot. With `spaced`, the slots are one pixel
 * apart, so they line up with a plot whose slots are one pixel apart too.
 *
 * Years divisible by 20 are labelled, and the other decades too on wider
 * screens (see `tickOf`). A label in the first or last slot is aligned
 * inwards, so it stays inside the chart.
 *
 * The axes and the plot are hidden from assistive technology.
 */
const InsightAxis: FC<Props> = ({ ats, top, spaced = false, children }) => (
  <div aria-hidden className="pt-5">
    <div className="relative h-48 border-b border-gray-300">
      <span className="absolute inset-x-0 top-0 border-t border-dashed border-gray-300" />
      <span className="absolute left-0 -top-5 text-xs text-gray-600 tabular-nums">
        {top}
      </span>
      {children}
    </div>
    <div data-spaced={spaced} className="flex h-5 data-[spaced=true]:gap-px">
      {ats.map((at) => (
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
);

export default InsightAxis;
