import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import InsightTitle from "./InsightTitle";

const meta = {
  title: "Insights/Insight title",
  component: InsightTitle,
  args: {
    id: "title",
    title: "Publications by decade",
    hint: "A first translation is the first edition of a work's first translation.",
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightTitle>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The title with a hint after it. The hint's button is named after the title,
 * and the heading's own text stays the title alone.
 */
export const WithHint: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("heading")).toHaveTextContent(
      /^Publications by decade$/,
    );
    await expect(
      canvas.getByRole("button", { name: "About Publications by decade" }),
    ).toBeInTheDocument();
  },
};

/** Without a hint, only the heading is shown. */
export const WithoutHint: Story = {
  args: { hint: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};
