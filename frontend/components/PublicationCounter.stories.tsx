import type { Meta, StoryObj } from "@storybook/react";
import { resetAll } from "modules/publication/store";
import { seed } from "modules/publication/fixtures";
import { expect, within } from "storybook/test";

import PublicationCounter from "./PublicationCounter";

const meta = {
  title: "Publications/Publication counter",
  component: PublicationCounter,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationCounter>;

export default meta;

type Story = StoryObj<typeof meta>;

/** With the 3 sample publications loaded, the counter reads "3". */
export const Default: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "3" }),
    ).toBeInTheDocument();
  },
};

/** A single publication — the button shows the count "1". */
export const Single: Story = {
  beforeEach: () => seed([{ title: "Dom Casmurro" }]),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "1" }),
    ).toBeInTheDocument();
  },
};

/** Nothing loaded — the counter hides itself entirely. */
export const Empty: Story = {
  beforeEach: () => resetAll(),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};
