import type { Meta, StoryObj } from "@storybook/react";
import { seed } from "modules/publication/fixtures";
import { expect, within } from "storybook/test";

import PublicationDuplicate from "./PublicationDuplicate";

const meta = {
  title: "Publications/Publication duplicate",
  component: PublicationDuplicate,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationDuplicate>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Acts on the shared selection store. With nothing selected it
 * still renders and reads "Duplicate 0" (a safe no-op on click).
 */
export const Default: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /Duplicate 0/ }),
    ).toBeInTheDocument();
  },
};
