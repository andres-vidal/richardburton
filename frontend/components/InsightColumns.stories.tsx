import type { Meta, StoryObj } from "@storybook/react";
import { CHARTS } from "test/insights-fixtures";
import { expect, within } from "storybook/test";

import InsightColumns from "./InsightColumns";

// The publications of each year in the fixtures, by country.
const YEARS = CHARTS.perYear.groups.map(({ key, counts }) => ({
  at: key as number,
  label: String(key),
  counts,
}));

// Returns the groups of a chart by decade as columns.
const decades = (groups: (typeof CHARTS)["byDecade"]["groups"]) =>
  groups.map(({ key, counts }) => ({
    at: key as number,
    label: `${key}s`,
    counts,
  }));

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
      [2, 0],
      [0, 0],
      [1, 1],
      [3, 0],
      [0, 1],
      [1, 0],
      [2, 2],
      [0, 0],
      [1, 0],
      [0, 1],
    ].map((counts, index) => ({
      at: 1960 + index,
      label: String(1960 + index),
      counts,
    })),
  },
};

/**
 * One series, with no legend: the original authors first translated in each
 * decade. The table has only the total column.
 */
export const OneSeries: Story = {
  args: {
    title: "Original authors by decade, first appearances only",
    heading: "Decade",
    series: ["Original authors"],
    columns: decades(CHARTS.debuts.groups),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByRole("list")).toBeNull();
    await expect(
      within(canvas.getByRole("table")).getAllByRole("columnheader"),
    ).toHaveLength(2);
  },
};

/**
 * The share of each kind in every decade. Each column is full height, and
 * hovering one shows each kind's count and share. The play test checks the
 * shares of the 1960s.
 */
export const Shares: Story = {
  args: {
    title: "Publications by decade and kind of publication, shares",
    heading: "Decade",
    series: ["First translations", "Retranslations", "Reissues"],
    columns: decades(CHARTS.byDecade.groups),
    shares: true,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("1960s · 21"),
    ).toHaveTextContent(
      "1960s · 21First translations 16 · 76%Retranslations 1 · 5%Reissues 4 · 19%",
    );
  },
};
