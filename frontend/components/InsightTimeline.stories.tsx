import type { Meta, StoryObj } from "@storybook/react";
import { CHARTS } from "test/insights-fixtures";
import { expect, within } from "storybook/test";

import InsightTimeline, { type Track } from "./InsightTimeline";

// The leading translators of the fixtures, with a dot for each year they
// published in, sized by the publications that year.
const TRANSLATORS: Track[] = CHARTS.leadingTranslators.groups.map(
  ({ key, total, steps = [] }) => ({
    key: String(key),
    label: String(key),
    value: String(total),
    marks: steps.map(({ at, total }) => ({
      year: at,
      weight: total,
      label: `${at} · ${total} ${total === 1 ? "publication" : "publications"}`,
    })),
  }),
);

// The retranslated works of the fixtures, with a dot for each translation.
const WORKS: Track[] = CHARTS.retranslated.groups.map(
  ({ key, total, steps = [] }) => {
    const { title, authors } = key as { title: string; authors: string[] };

    return {
      key: title,
      label: title,
      detail: authors.join(", "),
      value: `${total} translations`,
      marks: steps.flatMap(({ at, items }) =>
        items.map((translators) => ({
          year: at,
          label: `${at} · ${translators.join(", ")}`,
        })),
      ),
    };
  },
);

const meta = {
  title: "Insights/Insight timeline",
  component: InsightTimeline,
  args: { tracks: TRANSLATORS },
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
    await expect(items[0]).toHaveTextContent(/^Clifford E. Landers25/);
    await expect(items[0]).toHaveTextContent("1997 · 3 publications");
  },
};

/**
 * Works, each with a detail after its title and a dot for each translation.
 * Dots without a weight are all the same size. Hovering a dot shows its label,
 * such as the year and translators of a translation.
 */
export const Unweighted: Story = {
  args: { tracks: WORKS },
  play: async ({ canvasElement }) => {
    const work = within(canvasElement).getAllByRole("listitem")[0];

    await expect(work).toHaveTextContent(
      /^Dom Casmurro · Machado de Assis3 translations/,
    );
    await expect(work).toHaveTextContent("1997 · John Gledson");
  },
};
