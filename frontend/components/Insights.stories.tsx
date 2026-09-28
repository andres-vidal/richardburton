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
 * Everything the database holds, counted: the figures, the decades, the names
 * that recur most, and the works translated more than once.
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

    // Countries are stored by code and read by name.
    await expect(
      within(
        canvas.getByRole("region", { name: "Countries of publication" }),
      ).getAllByRole("listitem")[0],
    ).toHaveTextContent("United States259");
  },
};

/** A set of publications with no work translated twice leaves that list out. */
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

/** A search that matched nothing has nothing to count, and says so. */
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
 * What heads the page: how many publications are counted, the two views, and
 * the search that narrows them, with how the search was read.
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
