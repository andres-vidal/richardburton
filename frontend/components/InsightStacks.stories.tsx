import type { Meta, StoryObj } from "@storybook/react";
import { INSIGHTS } from "test/insights-fixtures";
import { expect, within } from "storybook/test";

import InsightStacks from "./InsightStacks";

const meta = {
  title: "Insights/Insight stacks",
  component: InsightStacks,
  args: {
    title: "Publications by decade",
    heading: "Decade",
    series: ["First translations", "Retranslations", "Reissues"],
    rows: INSIGHTS.decades.map(
      ({ decade, firstTranslations, retranslations, reissues }) => ({
        key: String(decade),
        label: `${decade}s`,
        counts: [firstTranslations, retranslations, reissues],
      }),
    ),
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
    ).toHaveTextContent("1960s162321");

    // What hovering the row for the 1960s shows.
    const row = within(canvasElement)
      .getAllByText("1960s")
      .map((label) => label.closest("li"))
      .find(Boolean) as HTMLElement;

    await expect(within(row).getByText("Retranslations 2")).toBeInTheDocument();
  },
};
