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

/**
 * What the cells of a table show. `text` cells write each value as text, with
 * the items of a list joined by commas. `fields` cells hold the inputs that
 * edit each value, which show each item of a list as a pill.
 */
type SkeletonCells = "text" | "fields";

/** How many placeholder rows the skeleton draws. */
const ROWS = 12;

// One variant of a cell: the shape that stands for the value, and the length
// of each shape in the cell, side by side.
type Variant = { shape: SkeletonShape; lengths: SkeletonLength[] };

// Returns a variant of lines, one with each of the `lengths`.
const lines = (...lengths: SkeletonLength[]): Variant => ({
  shape: "line",
  lengths,
});

// Returns a variant of pills, one with each of the `lengths`.
const pills = (...lengths: SkeletonLength[]): Variant => ({
  shape: "pill",
  lengths,
});

// The variants of the cells that hold one value, which are the same in both
// kinds of cell. Titles are long lines, and the year is a short line.
const SINGLE_VALUES = {
  text: [lines("long"), lines("full"), lines("medium")],
  book: [lines("full"), lines("medium"), lines("long")],
  number: [lines("medium")],
};

// The variants of a cell, for each kind of cell and each attribute type. The
// cells cycle through the variants. A list of names or countries is one line,
// or two lines side by side like names joined by a comma, in `text` cells, and
// one or two pills in `fields` cells.
const VARIANTS: Record<SkeletonCells, Record<PublicationKeyType, Variant[]>> = {
  text: {
    ...SINGLE_VALUES,
    array: [lines("long"), lines("medium", "short"), lines("full")],
    enumArray: [lines("medium"), lines("long"), lines("medium", "short")],
  },
  fields: {
    ...SINGLE_VALUES,
    array: [pills("long"), pills("medium", "short"), pills("long", "medium")],
    enumArray: [pills("medium"), pills("short", "short"), pills("short")],
  },
};

// The placeholder of one attribute's cell: the shapes of the attribute's type
// in `cells`, in the variant at `turn`, cycling. The cell has the inset that a
// real cell has around its text.
const CellPlaceholder: FC<{
  attribute: PublicationKey;
  cells: SkeletonCells;
  turn: number;
}> = ({ attribute, cells, turn }) => {
  const variants = VARIANTS[cells][Publication.ATTRIBUTE_TYPES[attribute]];
  const { shape, lengths } = variants[turn % variants.length];

  return (
    <div className="flex overflow-hidden gap-1 items-center px-4">
      {lengths.map((length, index) => (
        <SkeletonBar key={index} shape={shape} length={length} />
      ))}
    </div>
  );
};

interface Props {
  /** The attribute columns, in order. */
  attributes: PublicationKey[];
  /** What the table's cells show, `text` or `fields`. Defaults to `text`. */
  cells?: SkeletonCells;
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
 * In each placeholder row, a cell holds the shapes of its attribute's value as
 * `cells` show it. Titles and the year are lines. A list of names or countries
 * is lines in `text` cells and pills in `fields` cells. The lengths cycle by
 * row and column, so the rows differ from each other and the server and the
 * browser render the same markup. With `signal`, each row starts with an empty
 * cell, and each of the `trailing` cells holds a muted button shape. Each row
 * sets `--row` to its index, so the pulse moves down the rows.
 */
const PublicationIndexTableSkeleton: FC<Props> = ({
  attributes,
  cells = "text",
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
                cells={cells}
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
