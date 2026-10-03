import { CSSProperties, FC, useId } from "react";

/** One item in the list, with its count. */
type Bar = {
  key: string;
  /** The item's label, such as a name, a decade or a work's title. */
  label: string;
  /** Extra text shown after the label, such as a work's authors. */
  detail?: string;
  count: number;
  /** The count as text. It is shown beside the label, above the bar. */
  value: string;
};

type Props = {
  title: string;
  bars: Bar[];
};

/**
 * A titled list of counts. Each item has a bar whose length is its count as a
 * fraction of the largest count in the list.
 *
 * The caller formats each count as `value`, because the unit differs between
 * lists, such as publications or translations. Each bar is drawn under its
 * label and value, and is hidden from assistive technology, which reads the
 * label and value instead.
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
