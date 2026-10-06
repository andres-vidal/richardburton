import type { Meta, StoryObj } from "@storybook/react";
import { INSIGHTS } from "test/insights-fixtures";
import { expect, within } from "storybook/test";

import InsightTimeline, { type Track } from "./InsightTimeline";

// The leading translators of the fixtures, with a dot for each year they
// published in, sized by the publications that year.
const TRANSLATORS: Track[] = INSIGHTS.translators.map(
  ({ name, count, years }) => ({
    key: name,
    label: name,
    value: String(count),
    marks: years.map(({ year, count }) => ({
      year,
      weight: count,
      label: `${year} · ${count} ${count === 1 ? "publication" : "publications"}`,
    })),
  }),
);

// The retranslated works of the fixtures, with a dot for each translation.
const WORKS: Track[] = INSIGHTS.retranslated.map(
  ({ title, authors, translations, timeline }) => ({
    key: title,
    label: title,
    detail: authors.join(", "),
    value: `${translations} translations`,
    marks: timeline.map(({ year, translators }) => ({
      year,
      label: `${year} · ${translators.join(", ")}`,
    })),
  }),
);

const meta = {
  title: "Insights/Insight timeline",
  component: InsightTimeline,
  args: {
    title: "Translators with the most publications",
    tracks: TRANSLATORS,
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightTimeline>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Translators, each with a dot for every year they published in. A dot's size
 * is the number of publications that year, relative to the largest number in
 * the chart. The axis runs from the earliest decade to the end of the latest.
 */
export const Weighted: Story = {
  play: async ({ canvasElement }) => {
    const items = within(canvasElement).getAllByRole("listitem");

    // Each row reads its label and value, and the labels of its dots.
    await expect(items[0]).toHaveTextContent(/^Alison Entrekin25/);
    await expect(items[0]).toHaveTextContent("2012 · 8 publications");
  },
};

/**
 * Works, each with a detail after its title and a dot for each translation.
 * Dots without a weight are all the same size. Hovering a dot shows its label,
 * such as the year and translators of a translation.
 */
export const Unweighted: Story = {
  args: { title: "Works translated more than once", tracks: WORKS },
  play: async ({ canvasElement }) => {
    const work = within(canvasElement).getAllByRole("listitem")[0];

    await expect(work).toHaveTextContent(
      /^Dom Casmurro · Machado de Assis3 translations/,
    );
    await expect(work).toHaveTextContent("1997 · John Gledson");
  },
};
