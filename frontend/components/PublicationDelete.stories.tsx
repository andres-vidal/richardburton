import type { Meta, StoryObj } from "@storybook/react";
import { seed } from "modules/publication/fixtures";
import { expect, within } from "storybook/test";

import PublicationDelete from "./PublicationDelete";

const meta = {
  title: "Publications/Publication delete",
  component: PublicationDelete,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationDelete>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Acts on the react-selection-manager selection. With nothing selected it
 * still renders and reads "Delete 0" (a safe no-op on click).
 */
export const Default: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /Delete 0/ }),
    ).toBeInTheDocument();
  },
};
