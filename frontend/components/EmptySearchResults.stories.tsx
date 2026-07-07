import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import { EmptySearchResults } from "./EmptySearchResults";

const meta = {
  title: "Components/Empty Search Results",
  component: EmptySearchResults,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof EmptySearchResults>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The placeholder shown when a search returns nothing. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("No results found, try another query."),
    ).toBeInTheDocument();
  },
};
