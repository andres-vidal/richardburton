import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { seed } from "modules/publication/fixtures";
import { expect, within } from "storybook/test";

import PublicationDiscard from "./PublicationDiscard";

const meta = {
  title: "Publications/Publication discard",
  component: PublicationDiscard,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationDiscard>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Acts on the shared selection store. With nothing selected it
 * still renders and reads "Discard 0" (a safe no-op on click).
 */
export const Default: Story = {
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /Discard 0/ }),
    ).toBeInTheDocument();
  },
};
