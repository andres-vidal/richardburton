import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import DatabaseSummary from "./DatabaseSummary";

const meta = {
  title: "Components/Database summary",
  component: DatabaseSummary,
  args: { count: 428, view: "list" },
  parameters: { layout: "padded" },
} satisfies Meta<typeof DatabaseSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Above the list: the count of every publication, the list as the current
 * view, and the insights as a link.
 */
export const OverTheList: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvasElement).toHaveTextContent(
      "428 publications registered so far",
    );

    await expect(
      canvas.getByRole("link", { name: "Publications" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      canvas.getByRole("link", { name: "Insights" }),
    ).not.toHaveAttribute("aria-current");
  },
};

/** Above the insights: the same links, with the insights as the current view. */
export const OverTheInsights: Story = {
  args: { view: "insights" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: "Insights" }),
    ).toHaveAttribute("aria-current", "page");
  },
};

/**
 * With a search in the URL, the count is what the search found, and both links
 * keep the search.
 */
export const WhileSearching: Story = {
  args: { count: 35 },
  parameters: { nextjs: { navigation: { query: { search: "clarice" } } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvasElement).toHaveTextContent("35 publications found");

    await expect(
      canvas.getByRole("link", { name: "Publications" }),
    ).toHaveAttribute("href", "/en?search=clarice");
    await expect(
      canvas.getByRole("link", { name: "Insights" }),
    ).toHaveAttribute("href", "/en/insights?search=clarice");
  },
};
