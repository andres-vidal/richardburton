import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import PageHeader from "./PageHeader";

const meta = {
  title: "Components/Page header",
  component: PageHeader,
  args: {
    title: "Add publications",
    description: "Prepare new publications to be inserted in the database.",
  },
  decorators: [
    (Story) => (
      <div className="p-8 min-h-screen bg-white">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PageHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Title plus a muted description line. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("heading", { level: 1, name: "Add publications" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/Prepare new publications/),
    ).toBeInTheDocument();
  },
};

/** Title only — the description is optional. */
export const TitleOnly: Story = {
  args: { description: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("heading", { level: 1, name: "Add publications" }),
    ).toBeInTheDocument();
    await expect(canvas.queryByText(/Prepare/)).not.toBeInTheDocument();
  },
};
