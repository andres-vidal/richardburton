import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import { EmptySearchResults } from "./EmptySearchResults";

const meta = {
  title: "Components/Empty Search Results",
  component: EmptySearchResults,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof EmptySearchResults>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The URL has no search, so the line says the database has no publications
 * yet. The play test checks that it does not suggest another query.
 */
export const EmptyDatabase: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("No publications yet.")).toBeInTheDocument();
    await expect(
      canvas.queryByText("No results found, try another query."),
    ).not.toBeInTheDocument();
  },
};

/** The URL has a search that found nothing, so the line suggests another one. */
export const NoMatches: Story = {
  parameters: { nextjs: { navigation: { query: { search: "zzyzx" } } } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("No results found, try another query."),
    ).toBeInTheDocument();
  },
};
