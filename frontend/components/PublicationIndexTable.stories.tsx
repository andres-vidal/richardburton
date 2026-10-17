import type { Meta, StoryObj } from "@storybook/react";
import {
  publicationIdsAtom,
  resetAll,
  resetAttributes,
  setAttributesVisible,
  setField,
} from "modules/publication/store";
import { store } from "modules/store";
import { sampleManyPublications, seedIndex } from "test/publication-fixtures";
import {
  COLUMN_LABELS,
  expectColumnShapes,
  expectTableSkeleton,
} from "test/skeleton";
import { expect, within } from "storybook/test";

import { PublicationIndexTable, SignalColumn } from "./PublicationIndexTable";
import WorkspaceNotesCell from "./WorkspaceNotesCell";
import WorkspaceSourcesCell from "./WorkspaceSourcesCell";

const meta = {
  title: "Publications/Index table",
  component: PublicationIndexTable,
  // Normalize column visibility before every story so hidden-column state doesn't
  // leak between them (the store is a module singleton).
  beforeEach: () => resetAttributes(store),
  decorators: [
    (Story) => (
      <div className="p-4 overflow-x-auto">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PublicationIndexTable>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The index populated with a few publications. */
export const Default: Story = {
  beforeEach: () => seedIndex(store),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 3 seeded publications → 3 body rows (+ the header row). Cell contents are
    // gated behind an IntersectionObserver, so we assert on the rows themselves.
    await expect(canvas.getAllByRole("row")).toHaveLength(4);
  },
};

/**
 * The index shows saved values only. The editor in the modal edits the same
 * rows, so an unsaved edit must not appear in the table behind the modal.
 */
export const IgnoresPendingEdits: Story = {
  beforeEach: () => {
    seedIndex(store);
    const [id] = store.get(publicationIdsAtom)!;
    setField(store, id, "title", "Edited in the modal");
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The stored title still renders ("Dom Casmurro" is both title and original
    // title in the fixture, hence findAll)...
    await expect(
      (await canvas.findAllByText("Dom Casmurro")).length,
    ).toBeGreaterThan(0);
    // ...and the unsaved edit does not appear in the table.
    await expect(
      canvas.queryByText("Edited in the modal"),
    ).not.toBeInTheDocument();
  },
};

/** A search that matched nothing (ids loaded, but empty). */
export const Empty: Story = {
  beforeEach: () => seedIndex(store, []),
};

/**
 * The publications have not loaded, so the table shows a skeleton in its own
 * columns. The play test checks that the skeleton's header holds the label of
 * every column, and that every column holds lines, as the cells write each
 * value as text.
 */
export const Loading: Story = {
  beforeEach: () => {
    resetAll(store);
    resetAttributes(store);
  },
  play: async ({ canvasElement }) => {
    await expectColumnShapes(canvasElement, COLUMN_LABELS, "line");
    await expectTableSkeleton(canvasElement, COLUMN_LABELS);
  },
};

/**
 * The publications have not loaded while the column menu hides the Publishers
 * and Year columns. The play test checks that the skeleton leaves those
 * columns out too, and that the columns it shows hold lines.
 */
export const LoadingWithHiddenColumns: Story = {
  beforeEach: () => {
    resetAll(store);
    setAttributesVisible(store, ["publishers", "year"], false);
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
 * The publications have not loaded in a table with a signal column and the
 * notes and sources columns, which keeps the read-only cells. The skeleton has
 * an empty cell before the attributes and a button shape in each of the two
 * cells after them. The play test checks that the skeleton's header has an
 * empty cell before the labels and two after them, and that the columns still
 * hold lines, because the cells are text.
 */
export const LoadingWithSignalAndTrailingColumns: Story = {
  args: {
    ExtendedSignalColumn: SignalColumn,
    ExtendedTrailingColumns: [
      { name: "notes", Cell: WorkspaceNotesCell },
      { name: "sources", Cell: WorkspaceSourcesCell },
    ],
    collapsible: false,
  },
  beforeEach: () => {
    resetAll(store);
    resetAttributes(store);
  },
  play: async ({ canvasElement }) => {
    await expectColumnShapes(canvasElement, COLUMN_LABELS, "line");
    await expectTableSkeleton(canvasElement, ["", ...COLUMN_LABELS, "", ""]);
  },
};

/**
 * A large dataset in a fixed-height viewport — showcases vertical overflow (the
 * sticky header stays put while the body scrolls) and the row virtualization:
 * off-screen rows keep their ARIA structure and height but don't render or
 * subscribe their cells until they scroll into view.
 */
export const ManyRows: Story = {
  beforeEach: () => seedIndex(store, sampleManyPublications(100)),
  decorators: [
    (Story) => (
      <div className="h-[420px] overflow-auto rounded border border-gray-200">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Header + all 100 rows are present (off-screen ones keep their structure).
    await expect(canvas.getAllByRole("row")).toHaveLength(101);
  },
};

/**
 * Columns hidden through the column menu simply don't render — no header cell, no
 * body cells, no track in the grid. The remaining columns re-share the width.
 */
export const HiddenColumns: Story = {
  beforeEach: () => {
    seedIndex(store, sampleManyPublications(20));
    setAttributesVisible(store, ["publishers", "year"], false);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("columnheader", { name: "Title" });
    expect(
      canvas.queryByRole("columnheader", { name: "Publishers" }),
    ).toBeNull();
    expect(canvas.queryByRole("columnheader", { name: "Year" })).toBeNull();
  },
};
