import type { Meta, StoryObj } from "@storybook/react";
import { resetAll } from "modules/publication/store";
import { seed } from "modules/publication/fixtures";
import { expect, within } from "storybook/test";

import RowIdToggle from "./RowIdToggle";

const meta = {
  title: "Publications/Row id toggle",
  component: RowIdToggle,
  parameters: { layout: "centered" },
} satisfies Meta<typeof RowIdToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

/** With publications loaded, the toggle shows the row-number control. */
export const Default: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Row Ids" }),
    ).toBeInTheDocument();
  },
};

/** With nothing loaded, the toggle hides itself entirely. */
export const Empty: Story = {
  beforeEach: () => resetAll(),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};
