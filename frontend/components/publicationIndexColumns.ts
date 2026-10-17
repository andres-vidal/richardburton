import type { PublicationKey } from "modules/publication/model";

// The widest each column grows. The table aligns its columns to the left
// rather than stretching them, so hiding columns leaves the others at a
// readable width. A column can still shrink below its maximum to share the
// width when every column is shown.
const COLUMN_MAX_WIDTH: Partial<Record<PublicationKey, string>> = {
  year: "5.5rem",
  originalTitle: "20rem",
  title: "24rem",
};
const DEFAULT_COLUMN_MAX_WIDTH = "14rem";

/**
 * Returns the `grid-template-columns` of the publication index table. The
 * template has a 2.5rem track for the signal cell when `signal` is true, a
 * track for each of the `attributes` up to its maximum width in
 * `COLUMN_MAX_WIDTH`, and an `auto` track for each of the `trailing` cells.
 */
function gridTemplateColumns({
  signal,
  attributes,
  trailing,
}: {
  signal: boolean;
  attributes: PublicationKey[];
  trailing: number;
}): string {
  return [
    signal ? "2.5rem" : null,
    ...attributes.map(
      (attribute) =>
        `minmax(0, ${COLUMN_MAX_WIDTH[attribute] ?? DEFAULT_COLUMN_MAX_WIDTH})`,
    ),
    ...Array.from({ length: trailing }, () => "auto"),
  ]
    .filter(Boolean)
    .join(" ");
}

export { gridTemplateColumns };
