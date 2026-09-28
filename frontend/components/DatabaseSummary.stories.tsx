import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import DatabaseSummary from "./DatabaseSummary";

const meta = {
  title: "Components/Database summary",
  component: DatabaseSummary,
  args: { summary: "428 publications registered so far", view: "list" },
  parameters: { layout: "padded" },
} satisfies Meta<typeof DatabaseSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Heading the list: the list is the current view, and the insights are a link away. */
export const OverTheList: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("link", { name: "Publications" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      canvas.getByRole("link", { name: "Insights" }),
    ).not.toHaveAttribute("aria-current");
  },
};

/** Heading the insights, the same links with the other one current. */
export const OverTheInsights: Story = {
  args: { view: "insights" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: "Insights" }),
    ).toHaveAttribute("aria-current", "page");
  },
};

/** With a search in the address, both links keep it. */
export const WhileSearching: Story = {
  args: { summary: "35 publications found" },
  parameters: { nextjs: { navigation: { query: { search: "clarice" } } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("link", { name: "Publications" }),
    ).toHaveAttribute("href", "/en?search=clarice");
    await expect(
      canvas.getByRole("link", { name: "Insights" }),
    ).toHaveAttribute("href", "/en/insights?search=clarice");
  },
};
