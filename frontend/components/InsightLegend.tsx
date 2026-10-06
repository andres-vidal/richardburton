import { FC } from "react";

/**
 * The legend of a chart with up to three series. Each series is listed with a
 * swatch of its colour, in the order the chart stacks them. The colours come
 * from the `bg-series` utility, which the charts also use.
 */
const InsightLegend: FC<{ series: string[] }> = ({ series }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
    {series.map((label, index) => (
      <li key={label} className="flex gap-1.5 items-center">
        <span
          aria-hidden
          data-series={index}
          className="size-2.5 rounded-sm bg-series"
        />
        {label}
      </li>
    ))}
  </ul>
);

export default InsightLegend;
