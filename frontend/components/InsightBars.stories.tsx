import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import InsightBars from "./InsightBars";

const meta = {
  title: "Insights/Insight bars",
  component: InsightBars,
  args: {
    title: "Most translated authors",
    bars: [
      { key: "cl", label: "Clarice Lispector", count: 35, value: "35" },
      { key: "pc", label: "Paulo Coelho", count: 35, value: "35" },
      { key: "ma", label: "Machado de Assis", count: 24, value: "24" },
      { key: "ja", label: "Jorge Amado", count: 18, value: "18" },
      { key: "ev", label: "Erico Verissimo", count: 12, value: "12" },
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightBars>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Names and their counts, in the order given. The longest count draws the
 * longest bar, and the rest are measured against it.
 */
export const Names: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = canvas.getByRole("list");

    await expect(
      canvas.getByRole("region", { name: "Most translated authors" }),
    ).toContainElement(list);
    await expect(within(list).getAllByRole("listitem")[2]).toHaveTextContent(
      "Machado de Assis24",
    );
  },
};

/**
 * A count of nothing is listed with an empty bar, which is how a quiet decade
 * reads in a run of them.
 */
export const WithNothingCounted: Story = {
  args: {
    title: "Publications by decade",
    bars: [
      { key: "1880", label: "1880s", count: 3, value: "3" },
      { key: "1890", label: "1890s", count: 0, value: "0" },
      { key: "1900", label: "1900s", count: 2, value: "2" },
      { key: "1910", label: "1910s", count: 0, value: "0" },
      { key: "1920", label: "1920s", count: 6, value: "6" },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getAllByRole("listitem")[1],
    ).toHaveTextContent("1890s0");
  },
};

/**
 * A label can carry a detail after it, and the count can be written in words
 * other than publications.
 */
export const WithDetails: Story = {
  args: {
    title: "Works translated more than once",
    bars: [
      {
        key: "dc",
        label: "Dom Casmurro",
        detail: "Machado de Assis",
        count: 3,
        value: "3 translations",
      },
      {
        key: "he",
        label: "A hora da estrela",
        detail: "Clarice Lispector",
        count: 2,
        value: "2 translations",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getAllByRole("listitem")[0],
    ).toHaveTextContent("Dom Casmurro · Machado de Assis3 translations");
  },
};
