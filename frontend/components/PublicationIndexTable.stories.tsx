import type { Meta, StoryObj } from "@storybook/react";
import {
  overrideField,
  publicationIdsAtom,
  resetAll,
  resetAttributes,
  setAttributesVisible,
  store,
} from "modules/publication/store";
import { sampleManyPublications, seed } from "modules/publication/fixtures";
import { expect, within } from "storybook/test";

import { PublicationIndexTable } from "./PublicationIndexTable";

const meta = {
  title: "Publications/Index table",
  component: PublicationIndexTable,
  // Normalize column visibility before every story so hidden-column state doesn't
  // leak between them (the store is a module singleton).
  beforeEach: () => resetAttributes(),
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
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 3 seeded publications → 3 body rows (+ the header row). Cell contents are
    // gated behind an IntersectionObserver, so we assert on the rows themselves.
    await expect(canvas.getAllByRole("row")).toHaveLength(4);
  },
};

/**
 * The index shows what is *saved*. The modal's edit draft lives in the same
 * override overlay, so without this the values would visibly change in the table
 * beneath the open modal, before anything was saved.
 */
export const IgnoresPendingEdits: Story = {
  beforeEach: () => {
    seed();
    const [id] = store.get(publicationIdsAtom)!;
    overrideField(id, "title", "Edited in the modal");
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The stored title still renders ("Dom Casmurro" is both title and original
    // title in the fixture, hence findAll)...
    await expect(
      (await canvas.findAllByText("Dom Casmurro")).length,
    ).toBeGreaterThan(0);
    // ...and the pending edit is nowhere in the table.
    await expect(
      canvas.queryByText("Edited in the modal"),
    ).not.toBeInTheDocument();
  },
};

/** A search that matched nothing (ids loaded, but empty). */
export const Empty: Story = {
  beforeEach: () => seed([]),
};

/** Ids not loaded yet — the skeleton placeholder. */
export const Loading: Story = {
  beforeEach: () => {
    resetAll();
    resetAttributes();
  },
};

/**
 * A large dataset in a fixed-height viewport — showcases vertical overflow (the
 * sticky header stays put while the body scrolls) and the row virtualization:
 * off-screen rows keep their ARIA structure and height but don't render or
 * subscribe their cells until they scroll into view.
 */
export const ManyRows: Story = {
  beforeEach: () => seed(sampleManyPublications(100)),
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
    seed(sampleManyPublications(20));
    setAttributesVisible(["publishers", "year"], false);
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
