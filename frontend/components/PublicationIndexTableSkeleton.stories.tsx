import type { Meta, StoryObj } from "@storybook/react";
import { Publication } from "modules/publication/model";
import { expect } from "storybook/test";
import {
  COLUMN_LABELS,
  LIST_COLUMN_LABELS,
  expectColumnShapes,
  expectTableSkeleton,
  skeletonRows,
} from "test/skeleton";

import { PublicationIndexTableSkeleton } from "./PublicationIndexTableSkeleton";

const meta = {
  title: "Publications/Index table skeleton",
  component: PublicationIndexTableSkeleton,
  args: { attributes: Publication.ATTRIBUTES },
  decorators: [
    (Story) => (
      <div className="p-4 overflow-x-auto">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PublicationIndexTableSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The skeleton of the publication index, with every attribute column and
 * cells of text. The play test checks the status, that the header holds every
 * column's label, that each of the twelve rows carries its index in `--row`,
 * and that every column, the lists included, holds lines.
 */
export const IndexColumns: Story = {
  play: async ({ canvasElement }) => {
    await expectColumnShapes(canvasElement, COLUMN_LABELS, "line");
    await expectTableSkeleton(canvasElement, COLUMN_LABELS);
  },
};

/**
 * The skeleton without the Publishers and Year columns, as when the column
 * menu hides them. The play test checks that the header holds only the labels
 * of the columns that are shown, and that the columns hold lines.
 */
export const HiddenColumns: Story = {
  args: {
    attributes: Publication.ATTRIBUTES.filter(
      (attribute) => attribute !== "publishers" && attribute !== "year",
    ),
  },
  play: async ({ canvasElement }) => {
    const shown = COLUMN_LABELS.filter(
      (label) => label !== "Publishers" && label !== "Year",
    );

    await expectColumnShapes(canvasElement, shown, "line");
    await expectTableSkeleton(canvasElement, shown);
  },
};

/**
 * The skeleton of an import document's table, whose cells are fields and
 * whose rows start with a signal cell and end with the notes and sources
 * cells. The play test checks that the header has an empty cell before the
 * labels and two after them, that the grid has a track for every cell, and
 * that the lists of names and countries are pills.
 */
export const ImportDocument: Story = {
  args: { cells: "fields", signal: true, trailing: 2 },
  play: async ({ canvasElement }) => {
    const grid = skeletonRows(canvasElement)[0].parentElement as HTMLElement;

    await expect(
      getComputedStyle(grid).gridTemplateColumns.split(" "),
    ).toHaveLength(COLUMN_LABELS.length + 3);
    await expectColumnShapes(canvasElement, LIST_COLUMN_LABELS, "pill");
    await expectColumnShapes(
      canvasElement,
      ["Title", "Original Title", "Year"],
      "line",
    );
    await expectTableSkeleton(canvasElement, ["", ...COLUMN_LABELS, "", ""]);
  },
};
