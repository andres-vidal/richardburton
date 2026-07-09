import { times } from "lodash";
import { FC } from "react";

interface Props {
  rows: number;
}

const ListSkeleton: FC<Props> = ({ rows }) => {
  // `role="status"` on the wrapper announces "Loading"; the bars themselves are
  // decorative, so hide the list from assistive tech (an `aria-hidden` also keeps
  // its <li>s from being flagged as orphaned once the status role is applied).
  return (
    <div role="status" aria-label="Loading">
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
