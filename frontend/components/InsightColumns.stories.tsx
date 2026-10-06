import type { Meta, StoryObj } from "@storybook/react";
import { INSIGHTS } from "modules/insights-fixtures";
import { expect, within } from "storybook/test";

import InsightColumns, { type Column } from "./InsightColumns";

// The publications of each year in the fixtures, by country.
const YEARS: Column[] = INSIGHTS.annual.years.map(
  ({ year, counts, elsewhere }) => ({
    key: String(year),
    label: String(year),
    counts: [...counts, elsewhere],
    tick: year % 20 === 0 ? "major" : year % 10 === 0 ? "minor" : undefined,
  }),
);

const meta = {
  title: "Insights/Insight columns",
  component: InsightColumns,
  args: {
    title: "Publications per year",
    heading: "Year",
    series: ["United States", "United Kingdom", "Elsewhere"],
    columns: YEARS,
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightColumns>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Every year from 1886 to 2026, each stacking its publications in the United
 * States, in the United Kingdom and elsewhere. Years with none have no column
 * drawn, and the tallest column reaches the dashed line, labelled with its
 * total. Hovering a column shows its year, its total and its count in each
 * series, and the play test checks the text it shows.
 */
export const Years: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("region", { name: "Publications per year" }),
    ).toBeInTheDocument();

    // The table has a row for each year, after its header row.
    const table = canvas.getByRole("table", { name: "Publications per year" });
    const rows = within(table).getAllByRole("row");

    await expect(rows).toHaveLength(YEARS.length + 1);
    await expect(
      within(table).getByRole("row", { name: /^2012/ }),
    ).toHaveTextContent("2012105924");

    // What hovering the column for 2012 shows.
    await expect(canvas.getByText("2012 · 24")).toHaveTextContent(
      "2012 · 24United States 10United Kingdom 5Elsewhere 9",
    );
  },
};

/** A short span, as a search for one decade gives, with two series. */
export const OneDecade: Story = {
  args: {
    series: ["United States", "Elsewhere"],
    columns: [
      { key: "1960", label: "1960", counts: [2, 0], tick: "minor" },
      { key: "1961", label: "1961", counts: [0, 0] },
      { key: "1962", label: "1962", counts: [1, 1] },
      { key: "1963", label: "1963", counts: [3, 0] },
      { key: "1964", label: "1964", counts: [0, 1] },
      { key: "1965", label: "1965", counts: [1, 0] },
      { key: "1966", label: "1966", counts: [2, 2] },
      { key: "1967", label: "1967", counts: [0, 0] },
      { key: "1968", label: "1968", counts: [1, 0] },
      { key: "1969", label: "1969", counts: [0, 1] },
    ],
  },
};
