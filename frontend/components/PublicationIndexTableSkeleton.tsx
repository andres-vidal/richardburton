import { times } from "lodash";
import {
  Publication,
  type PublicationKey,
  type PublicationKeyType,
} from "modules/publication/model";
import { useTranslations } from "next-intl";
import { FC } from "react";
import { gridTemplateColumns } from "./publicationIndexColumns";
import {
  Skeleton,
  SkeletonBar,
  skeletonRow,
  type SkeletonLength,
  type SkeletonShape,
} from "./Skeleton";

/** How many placeholder rows the skeleton draws. */
const ROWS = 12;

// The shape that stands for a value of each attribute type. A title is a line
// of text, and a list of names is a row of pills.
const SHAPE: Record<PublicationKeyType, SkeletonShape> = {
  text: "line",
  book: "line",
  number: "line",
  array: "pill",
  enumArray: "pill",
};

// The lengths of the shapes in a cell, for each attribute type. Each entry is
// one variant of the cell, and the cells cycle through the variants. Titles
// are long lines, the year is a short line, a list of names is one or two
// pills, and countries are shorter pills.
const VARIANTS: Record<PublicationKeyType, SkeletonLength[][]> = {
  text: [["long"], ["full"], ["medium"]],
  book: [["full"], ["medium"], ["long"]],
  number: [["medium"]],
  array: [["long"], ["medium", "short"], ["long", "medium"]],
  enumArray: [["medium"], ["short", "short"], ["short"]],
};

// The placeholder of one attribute's cell: the shapes of the attribute's type,
// in the variant at `turn`, cycling. The cell has the inset that a real cell
// has around its text.
const CellPlaceholder: FC<{ attribute: PublicationKey; turn: number }> = ({
  attribute,
  turn,
}) => {
  const type = Publication.ATTRIBUTE_TYPES[attribute];
  const variants = VARIANTS[type];

  return (
    <div className="flex overflow-hidden gap-1 items-center px-4">
      {variants[turn % variants.length].map((length, index) => (
        <SkeletonBar key={index} shape={SHAPE[type]} length={length} />
      ))}
    </div>
  );
};

interface Props {
  /** The attribute columns, in order. */
  attributes: PublicationKey[];
  /** Whether each row starts with a signal cell. */
  signal?: boolean;
  /** How many cells follow the attributes in each row. */
  trailing?: number;
}

/**
 * A loading `Skeleton` in the shape of `PublicationIndexTable`. It lays out a
 * header row and twelve placeholder rows in the table's grid, with the
 * table's column template from `gridTemplateColumns`.
 *
 * The header row holds the label of each of the `attributes`, as plain text.
 * In each placeholder row, a cell holds the shapes of its attribute's value:
 * lines for titles and the year, and pills for lists of names. The lengths
 * cycle by row and column, so the rows differ from each other and the server
 * and the browser render the same markup. With `signal`, each row starts with
 * an empty cell, and each of the `trailing` cells holds a muted button shape.
 * Each row sets `--row` to its index, so the pulse moves down the rows.
 */
const PublicationIndexTableSkeleton: FC<Props> = ({
  attributes,
  signal = false,
  trailing = 0,
}) => {
  const t = useTranslations("attributes");

  return (
    <Skeleton>
      <div
        style={{
          gridTemplateColumns: gridTemplateColumns({
            signal,
            attributes,
            trailing,
          }),
        }}
        className="grid justify-start w-full"
      >
        <div className="grid col-span-full bg-gray-100 grid-cols-subgrid">
          {signal && <div />}
          {attributes.map((attribute) => (
            <div
              key={attribute}
              className="mx-0.5 px-3 py-2 font-semibold text-left truncate"
            >
              {t(attribute)}
            </div>
          ))}
          {times(trailing, (index) => (
            <div key={index} />
          ))}
        </div>
        {times(ROWS, (row) => (
          <div
            key={row}
            style={skeletonRow(row)}
            className="grid col-span-full min-h-9 grid-cols-subgrid"
          >
            {signal && <div />}
            {attributes.map((attribute, column) => (
              <CellPlaceholder
                key={attribute}
                attribute={attribute}
                turn={row + column}
              />
            ))}
            {times(trailing, (index) => (
              <div key={index} className="flex items-center px-2">
                <SkeletonBar shape="button" length="medium" muted />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Skeleton>
  );
};

export { PublicationIndexTableSkeleton };
