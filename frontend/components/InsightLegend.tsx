import { FC } from "react";

/**
 * The legend of a chart. Each entry in `series` is listed with a swatch of its
 * colour, in order.
 *
 * The swatches take the colours of up to three series from the `bg-series`
 * utility, which the charts also use. With `shaded`, the entries name the
 * bands of a shaded chart instead, from the lightest, and each swatch takes
 * its band's colour from `data-shade` in `styles/globals.css`.
 */
const InsightLegend: FC<{
  series: string[];
  /** Whether the entries are bands of shades rather than series. */
  shaded?: boolean;
}> = ({ series, shaded = false }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
    {series.map((label, index) => (
      <li key={label} className="flex gap-1.5 items-center">
        <span
          aria-hidden
          data-series={shaded ? undefined : index}
          data-shade={shaded ? index + 1 : undefined}
          className="size-2.5 rounded-sm bg-series data-[shade]:bg-(--shade)"
        />
        {label}
      </li>
    ))}
  </ul>
);

export default InsightLegend;
