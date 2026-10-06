import type { Meta, StoryObj } from "@storybook/react";
import { INSIGHTS, NOTHING } from "test/insights-fixtures";
import { worldMap } from "modules/world-map";
import { WorldMapProvider } from "modules/world-map-provider";
import { NUMERIC_CODES } from "test/messages";
import { expect, within } from "storybook/test";

import Insights, { InsightsHeading } from "./Insights";

const meta = {
  title: "Insights/Insights",
  component: Insights,
  args: { insights: INSIGHTS },
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
 * Counts for the whole database: the figures, the publications per year and
 * per decade, the names with the most publications, the authors first
 * translated in each decade, the leading author–translator pairs, the works
 * translated more than once, and the countries.
 */
export const Everything: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const name of [
      "Publications per year",
      "Publications by decade",
      "Most translated authors",
      "Authors first translated, by decade",
      "Translators with the most publications",
      "Most frequent author–translator pairs",
      "Works translated more than once",
      "Publishers with the most publications",
      "Publications by country",
    ]) {
      await expect(canvas.getByRole("region", { name })).toBeInTheDocument();
    }

    // The response has country codes, and the list shows country names.
    await expect(
      within(
        canvas.getByRole("region", { name: "Publications by country" }),
      ).getAllByRole("listitem")[0],
    ).toHaveTextContent("United States260");

    // The year chart is split by the response's two leading countries, named,
    // and everything else.
    await expect(
      within(
        canvas.getByRole("table", { name: "Publications per year" }),
      ).getAllByRole("columnheader"),
    ).toHaveLength(5);
    await expect(
      within(
        canvas.getByRole("region", { name: "Publications per year" }),
      ).getAllByRole("listitem")[1],
    ).toHaveTextContent("United Kingdom");
  },
};

/** When no work has more than one translation, that list is left out. */
export const NoWorkTranslatedTwice: Story = {
  args: { insights: { ...INSIGHTS, retranslated: [] } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole("region", {
        name: "Works translated more than once",
      }),
    ).toBeNull();
  },
};

/** When a search matches nothing, a message replaces the figures and lists. */
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
    await expect(canvas.queryByRole("list")).toBeNull();
  },
};

/**
 * The page's subheader: the number of publications counted, the links to the
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
  render: (args) => <InsightsHeading {...args} />,
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
