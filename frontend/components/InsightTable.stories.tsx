import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import InsightTable from "./InsightTable";

const meta = {
  title: "Insights/Insight table",
  component: InsightTable,
  args: {
    title: "Publications by decade",
    heading: "Decade",
    series: ["First translations", "Retranslations", "Reissues"],
    rows: [
      { key: "1950", label: "1950s", counts: [12, 1, 2] },
      { key: "1960", label: "1960s", counts: [16, 2, 3] },
    ],
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightTable>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A row for each entry, with its count in each series and its total. The
 * table is visually hidden, so the canvas is blank, and the play test reads
 * the table the way assistive technology does.
 */
export const Counts: Story = {
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole("table", {
      name: "Publications by decade",
    });
    const rows = within(table).getAllByRole("row");

    await expect(rows.map((row) => row.textContent)).toEqual([
      "DecadeFirst translationsRetranslationsReissuesTotal",
      "1950s121215",
      "1960s162321",
    ]);
  },
};
