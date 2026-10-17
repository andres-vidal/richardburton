import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import InsightSection from "./InsightSection";

const meta = {
  title: "Insights/Insight section",
  component: InsightSection,
  args: {
    title: "Publications by decade",
    hint: "A first translation is an edition published in the year the work was first translated.",
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

/**
 * Actions at the end of the title's row, such as a chart's settings. They are
 * part of the section, outside its heading, so the section is still named by
 * its title alone.
 */
export const WithActions: Story = {
  args: {
    actions: (
      <button
        type="button"
        className="py-1 px-2 text-sm rounded border border-gray-300"
      >
        Table
      </button>
    ),
  },
  play: async ({ canvasElement }) => {
    const section = within(canvasElement).getByRole("region", {
      name: "Publications by decade",
    });

    await expect(
      within(section).getByRole("button", { name: "Table" }),
    ).toBeInTheDocument();
  },
};
