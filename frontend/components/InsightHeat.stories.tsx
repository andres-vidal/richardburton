import type { Meta, StoryObj } from "@storybook/react";
import { CHARTS } from "test/insights-fixtures";
import { expect, within } from "storybook/test";

import InsightHeat from "./InsightHeat";

const meta = {
  title: "Insights/Insight heat",
  component: InsightHeat,
  args: {
    title: "Publications by original author",
    heading: "Original author",
    rows: CHARTS.authorsByDecade.groups.map(({ key, steps = [] }) => ({
      key: String(key),
      label: String(key),
      cells: steps.map(({ at, total, items }) => ({
        at,
        total,
        label: `${at}s · ${items.map((names) => names.join(", ")).join("; ")}`,
      })),
    })),
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightHeat>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The ten original authors with the most publications, with their
 * publications in each decade from the earliest to the latest. The largest
 * count has the darkest shade, decades with none are blank, and hovering a
 * cell shows the titles it counts. The play test reads the table and checks
 * the shade and tooltip of Clarice Lispector's 2010s.
 */
export const AuthorsByDecade: Story = {
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole("table", {
      name: "Publications by original author",
    });
    const header = within(table).getAllByRole("columnheader");

    await expect(header[0]).toHaveTextContent("Original author");
    await expect(header[1]).toHaveTextContent("1940s");

    const clarice = within(table).getByRole("row", {
      name: /^Clarice Lispector/,
    });
    const cell = within(clarice)
      .getAllByRole("cell")
      .find((each) => each.textContent === "18") as HTMLElement;

    await expect(cell).toHaveAttribute("data-shade", "4");
    await expect(cell.getAttribute("title")).toMatch(/^2010s · /);
  },
};

/** A row with a single decade, as a narrow search gives. */
export const OneDecade: Story = {
  args: {
    rows: [
      {
        key: "Clarice Lispector",
        label: "Clarice Lispector",
        cells: [{ at: 1960, total: 2, label: "1960s · 2 publications" }],
      },
    ],
  },
};
