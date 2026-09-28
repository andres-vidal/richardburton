import { CSSProperties, FC, useId } from "react";

/** One counted thing in a list of them. */
type Bar = {
  key: string;
  /** What is counted: a name, a decade, a work. */
  label: string;
  /** What else names it, read after the label: a work's authors. */
  detail?: string;
  count: number;
  /** The count in words, which is what the reader sees beside the bar. */
  value: string;
};

type Props = {
  title: string;
  bars: Bar[];
};

/**
 * A titled list of counts, each drawn as a bar whose length is its share of the
 * largest count in the list.
 *
 * The caller writes each count out in `value`, since what is counted differs
 * from one list to the next: publications in one, translations in another. The
 * bars are drawn beside the words and are hidden from assistive technology,
 * which reads the words.
 */
const InsightBars: FC<Props> = ({ title, bars }) => {
  const id = useId();
  const most = Math.max(1, ...bars.map(({ count }) => count));

  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-lg font-normal text-gray-900">
        {title}
      </h2>
      <ol className="space-y-2">
        {bars.map(({ key, label, detail, count, value }) => (
          <li
            key={key}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-baseline text-sm"
          >
            <span className="text-gray-900 break-words">
              {label}
              {detail && <span className="text-gray-600"> · {detail}</span>}
            </span>
            <span className="text-gray-700 tabular-nums">{value}</span>
            <span
              aria-hidden
              className="col-span-2 h-1.5 rounded-full bg-indigo-100"
            >
              <span
                style={{ "--share": count / most } as CSSProperties}
                className="block h-full w-[calc(var(--share)*100%)] rounded-full bg-indigo-500"
              />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default InsightBars;
export type { Bar };
