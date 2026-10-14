import type { Meta, StoryObj } from "@storybook/react";
import { PRESETS } from "modules/chart";
import { INSIGHTS, NOTHING } from "test/insights-fixtures";
import { worldMap } from "modules/world-map";
import { WorldMapProvider } from "modules/world-map-provider";
import { NUMERIC_CODES } from "test/messages";
import { expect, within } from "storybook/test";

import Insights, { InsightsHeading } from "./Insights";

const meta = {
  title: "Insights/Insights",
  component: Insights,
  args: { insights: INSIGHTS, description: PRESETS[0].description },
  decorators: [
    (Story) => (
      <WorldMapProvider map={worldMap(NUMERIC_CODES)}>
        <Story />
      </WorldMapProvider>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof Insights>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Counts for the whole database: the figures, and the chart builder on its
 * first preset, the publications per year.
 */
export const Everything: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("region", { name: "In figures" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("region", { name: "What the chart shows" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("region", { name: "Publications per year" }),
    ).toBeInTheDocument();
  },
};

/** When a search matches nothing, a message replaces the figures and the chart. */
export const NothingMatched: Story = {
  args: { insights: NOTHING },
  parameters: { nextjs: { navigation: { query: { search: "zzyzx" } } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByText(
        "No publications match this search, so there is nothing to count.",
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.queryByRole("region", { name: "What the chart shows" }),
    ).toBeNull();
  },
};

/**
 * The page's heading: the number of publications counted, the links to the
 * two views, and the search box with its report of the words it matched.
 */
export const Heading: Story = {
  args: {
    insights: {
      ...INSIGHTS,
      publications: 45,
      matched: [
        {
          field: null,
          typed: "clarise",
          words: ["clarice", "clara", "clarke"],
        },
      ],
    },
  },
  parameters: { nextjs: { navigation: { query: { search: "clarise" } } } },
  render: ({ insights }) => <InsightsHeading insights={insights} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("45 publications found")).toBeInTheDocument();
    await expect(
      canvas.getByRole("link", { name: "Insights" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByRole("textbox")).toHaveValue("clarise");
    await expect(
      canvas.getByRole("link", { name: "clarice" }),
    ).toBeInTheDocument();
  },
};
