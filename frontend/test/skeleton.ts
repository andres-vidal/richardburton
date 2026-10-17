import { expect, within } from "storybook/test";

/**
 * The English label of every attribute column of the publication index, in
 * the order of `Publication.ATTRIBUTES`.
 */
const COLUMN_LABELS = [
  "Title",
  "Original Title",
  "Translators",
  "Original Authors",
  "Year",
  "Countries",
  "Publishers",
];

/**
 * The English labels of the columns that hold a list: the translators, the
 * original authors, the countries and the publishers.
 */
const LIST_COLUMN_LABELS = [
  "Translators",
  "Original Authors",
  "Countries",
  "Publishers",
];

/**
 * Resolves once the skeleton status `status` has faded in.
 *
 * The accessibility check measures the contrast of the text in a skeleton,
 * such as the column labels of the table's skeleton. The text has less
 * contrast while the skeleton fades in, so the check needs this to resolve
 * first.
 */
async function skeletonAppeared(status: HTMLElement): Promise<void> {
  await Promise.all(status.getAnimations().map(({ finished }) => finished));
}

/** Returns the placeholder rows in `element`: the elements that set `--row`. */
function skeletonRows(element: HTMLElement): HTMLElement[] {
  return Array.from(element.querySelectorAll<HTMLElement>('[style*="--row"]'));
}

/**
 * Returns the text of each header cell of the table skeleton in `element`, in
 * order. The header row is the row before the first placeholder row. A header
 * cell without a label gives an empty string.
 */
function skeletonHeader(element: HTMLElement): string[] {
  const header = skeletonRows(element)[0]?.previousElementSibling;

  return Array.from(header?.children ?? [], (cell) => cell.textContent ?? "");
}

/**
 * Returns the shapes in the column of the table skeleton in `element` whose
 * header is `label`: the distinct `data-shape` values of its placeholder
 * cells, sorted.
 */
function skeletonShapes(element: HTMLElement, label: string): string[] {
  const column = skeletonHeader(element).indexOf(label);
  const shapes = skeletonRows(element).flatMap((row) =>
    Array.from(
      row.children[column].querySelectorAll<HTMLElement>("[data-shape]"),
      (shape) => shape.dataset.shape ?? "",
    ),
  );

  return [...new Set(shapes)].sort();
}

/**
 * Checks that every placeholder in the columns of the table skeleton in
 * `element` whose headers are `labels` has the shape `shape`.
 */
async function expectColumnShapes(
  element: HTMLElement,
  labels: string[],
  shape: string,
): Promise<void> {
  for (const label of labels) {
    await expect(skeletonShapes(element, label)).toEqual([shape]);
  }
}

/**
 * Checks the table skeleton in `canvasElement`. It expects a status named
 * "Loading" whose header cells hold the text in `header`, and twelve
 * placeholder rows, each with its index in `--row` and a cell for every header
 * cell. It resolves once the skeleton has faded in.
 */
async function expectTableSkeleton(
  canvasElement: HTMLElement,
  header: string[],
): Promise<void> {
  const status = within(canvasElement).getByRole("status", {
    name: "Loading",
  });
  const rows = skeletonRows(status);

  await expect(skeletonHeader(status)).toEqual(header);
  await expect(rows).toHaveLength(12);
  for (const [index, row] of rows.entries()) {
    await expect(row.style.getPropertyValue("--row")).toBe(String(index));
    await expect(row.children).toHaveLength(header.length);
  }
  await skeletonAppeared(status);
}

export {
  COLUMN_LABELS,
  LIST_COLUMN_LABELS,
  expectColumnShapes,
  expectTableSkeleton,
  skeletonAppeared,
  skeletonHeader,
  skeletonRows,
  skeletonShapes,
};
