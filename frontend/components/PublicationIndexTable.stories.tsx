import type { Meta, StoryObj } from "@storybook/react";
import { resetAll, resetAttributes } from "modules/publication";
import { seed } from "modules/publication/fixtures";
import { expect, userEvent, waitFor, within } from "storybook/test";

import PublicationHiddenAttributes from "./PublicationHiddenAttributes";
import { PublicationIndexTable } from "./PublicationIndexTable";

const meta = {
  title: "Publications/Index table",
  component: PublicationIndexTable,
  decorators: [
    (Story) => (
      <div className="flex items-stretch gap-2 p-4">
        {/* Toggleable columns hide into this left panel — click a chip to show
            the column again (the app renders it as the layout's leftAside). The
            wrapper stretches to the table's height so the chips' `h-full`
            resolves (there's no fixed-height container here as in the app). */}
        <div>
          <PublicationHiddenAttributes />
        </div>
        <div className="min-w-0 grow overflow-x-auto">
          <Story />
        </div>
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
 * Hiding a toggleable column (its header's hide button) moves it into the left
 * panel; clicking the panel's chip brings it back. The round-trip a user needs
 * — so it can't silently regress.
 */
export const HideAndRestoreColumn: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Year starts visible (its header carries a hide button); nothing is hidden.
    const hideYear = await canvas.findByRole("button", { name: "Hide Year" });
    expect(canvas.queryByRole("button", { name: "Show Year" })).toBeNull();

    // Hiding drops a "Show Year" chip into the panel and removes the column.
    await userEvent.click(hideYear);
    await canvas.findByRole("button", { name: "Show Year" });
    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: "Hide Year" })).toBeNull(),
    );

    // Clicking the chip restores the column and clears the chip.
    await userEvent.click(canvas.getByRole("button", { name: "Show Year" }));
    await canvas.findByRole("button", { name: "Hide Year" });
    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: "Show Year" })).toBeNull(),
    );
  },
};
