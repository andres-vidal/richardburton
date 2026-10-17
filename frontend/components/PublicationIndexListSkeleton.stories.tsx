import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { skeletonAppeared, skeletonRows } from "test/skeleton";

import { PublicationIndexListSkeleton } from "./PublicationIndexListSkeleton";

const meta = {
  title: "Publications/Index list skeleton",
  component: PublicationIndexListSkeleton,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PublicationIndexListSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Ten placeholder entries in the shape of the index list's entries. The play
 * test checks that they sit in a status named "Loading", and that each entry
 * carries its index in `--row`.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole("status", {
      name: "Loading",
    });
    const entries = skeletonRows(status);

    await expect(entries).toHaveLength(10);
    for (const [index, entry] of entries.entries()) {
      await expect(entry.style.getPropertyValue("--row")).toBe(String(index));
    }
    await skeletonAppeared(status);
  },
};
