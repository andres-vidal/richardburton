import { CSSProperties, FC, useId } from "react";
import InsightTitle from "./InsightTitle";

/** A dot on a row, at a year. */
type Mark = {
  year: number;
  /** What the dot stands for, such as "1953 · Helen Caldwell". */
  label: string;
  /**
   * The dot's size, relative to the other dots in the chart, such as a number
   * of publications. Dots without a weight are drawn at a third of the size
   * range.
   */
  weight?: number;
};

/** One row of the chart, such as a translator or a work. */
type Track = {
  key: string;
  label: string;
  /** Extra text shown after the label, such as a work's authors. */
  detail?: string;
  /** The row's count as text, shown beside its label. */
  value: string;
  marks: Mark[];
};

type Props = {
  title: string;
  /** What the chart shows, in a tooltip beside the title. */
  hint?: string;
  tracks: Track[];
};

// Returns the first year of the decade a year falls in.
const decade = (year: number) => Math.floor(year / 10) * 10;

/**
 * A titled list of rows on one axis of years. Each row shows its label and
 * value, and a track with a dot at the year of each mark, joined by a line
 * from the first mark to the last. The axis runs from the decade of the
 * earliest mark to the end of the decade of the latest, and its decades are
 * written under the rows. The labels at either end are aligned inwards, so
 * they stay inside the axis.
 *
 * Hovering a dot shows its mark's label. The tracks are hidden from assistive
 * technology, which reads each row's label, value and the labels of its marks.
 */
const InsightTimeline: FC<Props> = ({ title, hint, tracks }) => {
  const id = useId();

  const years = tracks.flatMap(({ marks }) => marks.map(({ year }) => year));
  const first = decade(Math.min(...years));
  const last = decade(Math.max(...years)) + 10;
  const at = (year: number) => (year - first) / (last - first);

  const heaviest = Math.max(
    1,
    ...tracks.flatMap(({ marks }) => marks.map(({ weight }) => weight ?? 0)),
  );
  const weigh = (weight?: number) =>
    weight === undefined ? 1 / 3 : weight / heaviest;

  const decades = Array.from(
    { length: (last - first) / 10 + 1 },
    (_, index) => first + index * 10,
  );

  return (
    <section aria-labelledby={id} className="space-y-3">
      <InsightTitle id={id} title={title} hint={hint} />
      <ol className="space-y-3 sm:space-y-2">
        {tracks.map(({ key, label, detail, value, marks }) => (
          <li
            key={key}
            className="grid gap-x-4 gap-y-1 items-center text-sm sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
          >
            <span className="flex gap-3 justify-between min-w-0">
              <span className="text-gray-900 break-words">
                {label}
                {detail && <span className="text-gray-600"> · {detail}</span>}
              </span>
              <span className="text-gray-700 tabular-nums whitespace-nowrap">
                {value}
              </span>
            </span>
            <span aria-hidden className="relative h-5">
              <span
                style={
                  {
                    "--from": at(marks[0].year),
                    "--to": at(marks[marks.length - 1].year),
                  } as CSSProperties
                }
                className="absolute top-1/2 h-px bg-gray-300 left-[calc(var(--from)*100%)] w-[calc((var(--to)-var(--from))*100%)]"
              />
              {marks.map(({ year, label, weight }) => (
                <span
                  key={`${year} ${label}`}
                  style={
                    {
                      "--at": at(year),
                      "--weight": weigh(weight),
                    } as CSSProperties
                  }
                  className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 left-[calc(var(--at)*100%)]"
                >
                  <span className="block rounded-full ring-1 ring-white transition-colors bg-indigo-600/80 size-[calc(0.5rem+var(--weight)*0.75rem)] group-hover:bg-indigo-900" />
                  <span className="hidden absolute bottom-full z-10 py-1 px-2 mb-1 text-xs text-white whitespace-nowrap bg-gray-900 rounded pointer-events-none group-hover:block absolute-center-x">
                    {label}
                  </span>
                </span>
              ))}
            </span>
            <span className="sr-only">
              {marks.map(({ label }) => label).join(", ")}
            </span>
          </li>
        ))}
      </ol>
      <div
        aria-hidden
        className="grid gap-x-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
      >
        <span className="hidden sm:block" />
        <span className="relative h-5 border-t border-gray-300">
          {decades.map((year) => (
            <span
              key={year}
              data-tick={year % 20 === 0 ? "major" : "minor"}
              data-edge={
                year === first ? "start" : year === last ? "end" : undefined
              }
              style={{ "--at": at(year) } as CSSProperties}
              className="hidden absolute top-1 text-xs text-gray-600 -translate-x-1/2 tabular-nums left-[calc(var(--at)*100%)] data-[edge=end]:-translate-x-full data-[edge=start]:translate-x-0 data-[tick=major]:block md:data-[tick=minor]:block"
            >
              {year}
            </span>
          ))}
        </span>
      </div>
    </section>
  );
};

export default InsightTimeline;
export type { Mark, Track };
