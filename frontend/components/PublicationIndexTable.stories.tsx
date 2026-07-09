import type { Meta, StoryObj } from "@storybook/react";
import { resetAll, resetAttributes } from "modules/publication";
import { sampleManyPublications, seed } from "modules/publication/fixtures";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { PublicationIndexTable } from "./PublicationIndexTable";

const meta = {
  title: "Publications/Index table",
  component: PublicationIndexTable,
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
 * Hiding a toggleable column (its header's hide button) collapses it in place to
 * a narrow labelled strip; clicking that strip brings the column back. The
 * round-trip a user needs — so it can't silently regress.
 */
export const HideAndRestoreColumn: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Year starts visible (its header carries a hide button); nothing is hidden.
    const hideYear = await canvas.findByRole("button", { name: "Hide Year" });
    expect(canvas.queryByRole("button", { name: "Show Year" })).toBeNull();

    // Hiding collapses the column to a "Show Year" restore strip in its header.
    await userEvent.click(hideYear);
    await canvas.findByRole("button", { name: "Show Year" });
    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: "Hide Year" })).toBeNull(),
    );

    // Clicking the strip restores the column and removes the strip.
    await userEvent.click(canvas.getByRole("button", { name: "Show Year" }));
    await canvas.findByRole("button", { name: "Hide Year" });
    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: "Show Year" })).toBeNull(),
    );
  },
};
