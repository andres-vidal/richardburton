import { times } from "lodash";
import { FC } from "react";
import {
  Skeleton,
  SkeletonBar,
  skeletonRow,
  type SkeletonLength,
} from "./Skeleton";

/** How many placeholder entries the skeleton draws. */
const ENTRIES = 10;

// The lengths of the lines in an entry, one variant per entry, cycling. The
// translators are shorter than the title, and the summary fills one line and
// part of the next.
const TITLE: SkeletonLength[] = ["long", "full", "long"];
const TRANSLATORS: SkeletonLength[] = ["medium", "short", "medium"];
const SUMMARY_END: SkeletonLength[] = ["medium", "long", "short"];

/**
 * A loading `Skeleton` in the shape of `PublicationIndexList`: ten
 * placeholder entries, each a card the size of an entry. On the left, a card
 * has a line for the title and a shorter one for the translators, and two
 * muted lines for the summary of the original book. On the right, it has a
 * line for the year and a muted one for the countries. The lengths cycle by entry, so
 * the entries differ from each other and the server and the browser render
 * the same markup. Each entry sets `--row` to its index, so the pulse moves
 * down the list.
 */
const PublicationIndexListSkeleton: FC = () => (
  <Skeleton>
    <ul className="space-y-4">
      {times(ENTRIES, (index) => (
        <li
          key={index}
          style={skeletonRow(index)}
          className="flex gap-4 justify-between mr-1 rounded-lg border border-gray-200"
        >
          <div className="p-2 space-y-4 grow">
            <div>
              <div className="flex items-center h-6">
                <SkeletonBar length={TITLE[index % TITLE.length]} />
              </div>
              <div className="flex items-center h-6">
                <SkeletonBar length={TRANSLATORS[index % TRANSLATORS.length]} />
              </div>
            </div>
            <div>
              <div className="flex items-center h-5">
                <SkeletonBar muted />
              </div>
              <div className="flex items-center h-5">
                <SkeletonBar
                  length={SUMMARY_END[index % SUMMARY_END.length]}
                  muted
                />
              </div>
            </div>
          </div>
          <div className="p-2 w-14 shrink-0">
            <div className="flex items-center h-6">
              <SkeletonBar />
            </div>
            <div className="flex justify-center items-center h-4">
              <SkeletonBar length="long" muted />
            </div>
          </div>
        </li>
      ))}
    </ul>
  </Skeleton>
);

export { PublicationIndexListSkeleton };
