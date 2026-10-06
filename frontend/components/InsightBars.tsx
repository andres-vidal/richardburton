import { useFormatter } from "next-intl";
import { CSSProperties, FC } from "react";
import InsightSection from "./InsightSection";

type Props = {
  title: string;
  /** What the list shows, in a tooltip beside the title. */
  hint?: string;
  /** The items, in the order they are listed. */
  bars: {
    key: string;
    /** The item's label, such as a name or a decade. */
    label: string;
    /** Extra text shown after the label, such as a translator. */
    detail?: string;
    count: number;
  }[];
};

/**
 * A titled list of counts. Each item shows its label and its count, formatted
 * for the reader's locale, above a bar whose length is its count as a fraction
 * of the largest count in the list.
 *
 * The bars are hidden from assistive technology, which reads the label and the
 * count instead.
 */
const InsightBars: FC<Props> = ({ title, hint, bars }) => {
  const format = useFormatter();
  const most = Math.max(1, ...bars.map(({ count }) => count));

  return (
    <InsightSection title={title} hint={hint}>
      <ol className="space-y-2">
        {bars.map(({ key, label, detail, count }) => (
          <li
            key={key}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-baseline text-sm"
          >
            <span className="text-gray-900 break-words">
              {label}
              {detail && <span className="text-gray-600"> · {detail}</span>}
            </span>
            <span className="text-gray-700 tabular-nums">
              {format.number(count)}
            </span>
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
    </InsightSection>
  );
};

export default InsightBars;
