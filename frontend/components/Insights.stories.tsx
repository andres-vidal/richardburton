import type { Meta, StoryObj } from "@storybook/react";
import { INSIGHTS, NOTHING } from "modules/insights-fixtures";
import { expect, within } from "storybook/test";

import Insights, { InsightsHeading } from "./Insights";

const meta = {
  title: "Insights/Insights",
  component: Insights,
  args: { insights: INSIGHTS },
  parameters: { layout: "padded" },
} satisfies Meta<typeof Insights>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Counts for the whole database: the figures, the decades, the names with the
 * most publications, the countries, and the works translated more than once.
 */
export const Everything: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const name of [
      "Publications by decade",
      "Most translated authors",
      "Translators with the most publications",
      "Publishers with the most publications",
      "Countries of publication",
      "Works translated more than once",
    ]) {
      await expect(canvas.getByRole("region", { name })).toBeInTheDocument();
    }

    // The response has country codes, and the list shows country names.
    await expect(
      within(
        canvas.getByRole("region", { name: "Countries of publication" }),
      ).getAllByRole("listitem")[0],
    ).toHaveTextContent("United States259");
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
