import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import InsightLegend from "./InsightLegend";

const meta = {
  title: "Insights/Insight legend",
  component: InsightLegend,
  args: { series: ["United States", "United Kingdom", "Elsewhere"] },
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightLegend>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Three series, each with a swatch of its colour: the main series, one that
 * stands out from it, and a muted one.
 */
export const ThreeSeries: Story = {
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole("listitem");

    await expect(items.map((item) => item.textContent)).toEqual([
      "United States",
      "United Kingdom",
      "Elsewhere",
    ]);
  },
};

/** Two series take the first two colours. */
export const TwoSeries: Story = {
  args: { series: ["United States", "Elsewhere"] },
};
