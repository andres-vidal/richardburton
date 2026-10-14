import type { Meta, StoryObj } from "@storybook/react";
import { cumulative } from "modules/chart";
import { years } from "test/charts";
import { CHARTS } from "test/insights-fixtures";
import { expect, within } from "storybook/test";

import InsightLines from "./InsightLines";

const meta = {
  title: "Insights/Insight lines",
  component: InsightLines,
  args: {
    title: "Publications by year and leading countries",
    heading: "Year",
    series: ["United States", "United Kingdom", "Elsewhere"],
    points: years(CHARTS.perYear.groups),
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightLines>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A line for each country's publications in each year from 1886 to 2026.
 * Hovering a year draws a line through it with a dot on each series, and shows
 * the year's total and its count in each series. The play test checks the
 * text it shows for 2012.
 */
export const Lines: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvasElement.querySelectorAll("polyline")).toHaveLength(3);
    await expect(canvas.getByText("2012 · 24")).toHaveTextContent(
      "2012 · 24United States 10United Kingdom 5Elsewhere 9",
    );
  },
};

/**
 * The same counts as stacked areas, so the top of the last area is each
 * year's total, and the largest total labels the top of the chart. The play
 * test checks that each series is an area.
 */
export const StackedArea: Story = {
  args: { stacked: true },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("polygon")).toHaveLength(3);
  },
};

/**
 * The running total of works, each counted in the year of its first
 * publication, with one series and no legend. The line ends at the number of
 * works in the database.
 */
export const RunningTotal: Story = {
  args: {
    title: "Works by year, running total",
    series: ["Works"],
    points: cumulative(years(CHARTS.worksByYear.groups)),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByRole("list")).toBeNull();
    await expect(
      within(canvas.getByRole("table")).getByRole("row", { name: /^2026/ }),
    ).toHaveTextContent("2026323");
  },
};
