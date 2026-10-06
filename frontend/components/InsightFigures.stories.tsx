import type { Meta, StoryObj } from "@storybook/react";
import { INSIGHTS, NOTHING } from "modules/insights-fixtures";
import { expect, within } from "storybook/test";

import InsightFigures from "./InsightFigures";

const meta = {
  title: "Insights/Insight figures",
  component: InsightFigures,
  args: { insights: INSIGHTS },
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightFigures>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Every figure, each with its term before its value in the markup. */
export const Figures: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const terms = canvas.getAllByRole("term");
    const values = canvas.getAllByRole("definition");

    await expect(terms.map((term) => term.textContent)).toEqual([
      "Publications",
      "Works",
      "Original authors",
      "Translators",
      "Publishers",
      "Countries",
      "Years",
      "Cite a source",
    ]);
    await expect(values.map((value) => value.textContent)).toEqual([
      "428",
      "323",
      "160",
      "161",
      "174",
      "10",
      "1886–2026",
      "3 of 428",
    ]);
  },
};

/** With no publications there are no years, so the Years figure is a dash. */
export const NothingCounted: Story = {
  args: { insights: NOTHING },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getAllByRole("definition")[6],
    ).toHaveTextContent("—");
  },
};
