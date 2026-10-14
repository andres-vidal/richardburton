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

/**
 * The four bands of a shaded chart, from the lightest. The play test checks
 * that each swatch is coloured by its band.
 */
export const Shaded: Story = {
  args: {
    series: ["1 publication", "2 to 9", "10 to 99", "100 or more"],
    shaded: true,
  },
  play: async ({ canvasElement }) => {
    const swatches = [...canvasElement.querySelectorAll("[data-shade]")];

    await expect(
      swatches.map((swatch) => swatch.getAttribute("data-shade")),
    ).toEqual(["1", "2", "3", "4"]);
    await expect(getComputedStyle(swatches[3]).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
  },
};
