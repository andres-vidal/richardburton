import { times } from "lodash";
import { useTranslations } from "next-intl";
import { FC } from "react";

interface Props {
  /** How many placeholder rows to draw. */
  rows: number;
}

/**
 * Renders `rows` grey bars that pulse while a list loads. Past the eighth, the
 * bars fade towards the end of the list. The wrapper is a status named
 * "Loading", and the bars are hidden from assistive technology.
 */
const ListSkeleton: FC<Props> = ({ rows }) => {
  const t = useTranslations("common");

  return (
    <div role="status" aria-label={t("loading")}>
      <ul aria-hidden="true" className="w-full space-y-2 animate-pulse">
        {times(rows, (index) => (
          <li
            key={index}
            className="w-full h-8 bg-gray-200 rounded hover:bg-indigo-100"
            style={{
              opacity: index > 7 ? 1 - (2 * (index - rows / 2)) / rows : 1,
            }}
          />
        ))}
      </ul>
    </div>
  );
};

export { ListSkeleton };
