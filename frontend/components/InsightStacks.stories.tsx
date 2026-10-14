import type { Meta, StoryObj } from "@storybook/react";
import { decades } from "test/charts";
import { CHARTS } from "test/insights-fixtures";
import { expect, within } from "storybook/test";

import InsightStacks from "./InsightStacks";

// Returns the row of the list whose label is `label`.
const row = (canvasElement: HTMLElement, label: string) =>
  within(canvasElement)
    .getAllByText(label)
    .map((each) => each.closest("li"))
    .find(Boolean) as HTMLElement;

const meta = {
  title: "Insights/Insight stacks",
  component: InsightStacks,
  args: {
    title: "Publications by decade",
    heading: "Decade",
    series: ["First translations", "Retranslations", "Reissues"],
    rows: decades(CHARTS.byDecade.groups),
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightStacks>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Every decade with its total, and a bar that stacks its first translations,
 * retranslations and reissues. Decades with no publications have an empty
 * bar. Hovering a row shows its count in each series, and the play test checks
 * the text it shows.
 */
export const Decades: Story = {
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole("table", {
      name: "Publications by decade",
    });

    await expect(
      within(table).getByRole("row", { name: /^1960s/ }),
    ).toHaveTextContent("1960s161421");

    // What hovering the row for the 1960s shows.
    await expect(
      within(row(canvasElement, "1960s")).getByText("Retranslations 1"),
    ).toBeInTheDocument();
  },
};

/**
 * The share of each kind in every decade. Every bar fills its track, and
 * hovering a row shows each kind's count and share.
 */
export const Shares: Story = {
  args: { shares: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(row(canvasElement, "1960s")).getByText("Reissues 4 · 19%"),
    ).toBeInTheDocument();
  },
};
