import type { Meta, StoryObj } from "@storybook/react";
import { resetAll } from "modules/publication/store";
import { seed } from "modules/publication/fixtures";
import { expect, within } from "storybook/test";

import { PublicationIndexList } from "./PublicationIndexList";

const meta = {
  title: "Publications/Index list",
  component: PublicationIndexList,
  args: { onItemClick: () => () => {} },
  parameters: { layout: "padded" },
} satisfies Meta<typeof PublicationIndexList>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The mobile list populated with a few publications. */
export const Default: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("The Hour of the Star"),
    ).toBeInTheDocument();
  },
};

/** A search that matched nothing. */
export const Empty: Story = {
  beforeEach: () => seed([]),
};

/** Ids not loaded yet — the skeleton placeholder. */
export const Loading: Story = {
  beforeEach: () => resetAll(),
};
