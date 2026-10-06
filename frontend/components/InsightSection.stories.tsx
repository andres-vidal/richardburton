import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import InsightSection from "./InsightSection";

const meta = {
  title: "Insights/Insight section",
  component: InsightSection,
  args: {
    title: "Publications by decade",
    hint: "A first translation is the first edition of a work's first translation.",
    children: (
      <p className="text-sm text-gray-700">The content of the section.</p>
    ),
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightSection>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The title with a hint after it, and the content below. The section is named
 * by its title, the hint's button is named after the title, and the heading's
 * own text stays the title alone.
 */
export const WithHint: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const section = canvas.getByRole("region", {
      name: "Publications by decade",
    });

    await expect(within(section).getByRole("heading")).toHaveTextContent(
      /^Publications by decade$/,
    );
    await expect(
      within(section).getByRole("button", {
        name: "About Publications by decade",
      }),
    ).toBeInTheDocument();
    await expect(section).toHaveTextContent("The content of the section.");
  },
};

/** Without a hint, the section has only its heading and content. */
export const WithoutHint: Story = {
  args: { hint: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};
