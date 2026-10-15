import type { Meta, StoryObj } from "@storybook/react";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { ADDRESS } from "modules/address";
import { PRESETS } from "modules/chart";
import { worldMap } from "modules/world-map";
import { WorldMapProvider } from "modules/world-map-provider";
import { CHARTS } from "test/insights-fixtures";
import { NUMERIC_CODES } from "test/messages";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import ChartBuilder from "./ChartBuilder";

// Returns the description of the preset named `name`.
const preset = (name: string) =>
  PRESETS.find((each) => each.name === name)!.description;

// Opens the control named `label` and picks the option named `option`.
async function pick(canvasElement: HTMLElement, label: string, option: string) {
  await userEvent.click(within(canvasElement).getByLabelText(label));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

// Stands in for `ADDRESS.replace`, so a change drawn without asking the server
// leaves the story frame's own address alone.
const replaceAddress = fn<(href: string) => void>().mockName("ADDRESS.replace");

const meta = {
  title: "Insights/Chart builder",
  component: ChartBuilder,
  args: { description: preset("perYear"), drawn: CHARTS.perYear },
  beforeEach: () => {
    const replace = ADDRESS.replace;
    replaceAddress.mockClear();
    ADDRESS.replace = replaceAddress;

    return () => {
      ADDRESS.replace = replace;
    };
  },
  decorators: [
    (Story) => (
      <WorldMapProvider map={worldMap(NUMERIC_CODES)}>
        <Story />
      </WorldMapProvider>
    ),
  ],
  parameters: {
    layout: "padded",
    nextjs: { navigation: { pathname: "/insights" } },
  },
} satisfies Meta<typeof ChartBuilder>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The first preset, shown in the preset select. The other controls of the
 * toolbar read "Publications, by year, split by country, as columns". Choosing
 * another grouping writes the new chart to the address, keeping the split and
 * the form, which still fit, and the play test checks the address.
 */
export const Controls: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("Preset")).toHaveValue(
      "Publications per year",
    );
    await expect(canvas.getByLabelText("What to count")).toHaveValue(
      "Publications",
    );
    await expect(canvas.getByLabelText("Split by")).toHaveValue(
      "split by country",
    );

    await pick(canvasElement, "Group by", "by decade");

    await expect(getRouter().replace).toHaveBeenLastCalledWith(
      "/insights?count=publications&by=decade&split=country&form=columns",
      { scroll: false },
    );
  },
};

/**
 * Choosing a preset writes all of its settings to the address, here the works
 * translated more than once on a timeline.
 */
export const ChoosingAPreset: Story = {
  play: async ({ canvasElement }) => {
    await pick(canvasElement, "Preset", "Works translated more than once");

    await expect(getRouter().replace).toHaveBeenLastCalledWith(
      "/insights?count=translations&by=work&form=timeline&top=10&least=2",
      { scroll: false },
    );
  },
};

/**
 * A change keeps the search in the address, both when the server reads the new
 * chart and when the chart is drawn without asking it.
 */
export const KeepingTheSearch: Story = {
  parameters: {
    nextjs: {
      navigation: { pathname: "/insights", query: { search: "clarice" } },
    },
  },
  play: async ({ canvasElement }) => {
    await pick(canvasElement, "Show as", "as lines");

    await expect(replaceAddress).toHaveBeenLastCalledWith(
      "/insights?search=clarice&count=publications&by=year&split=country&form=lines",
    );

    await pick(canvasElement, "Group by", "by decade");

    await expect(getRouter().replace).toHaveBeenLastCalledWith(
      "/insights?search=clarice&count=publications&by=decade&split=country&form=lines",
      { scroll: false },
    );
  },
};

/**
 * Columns, lines and stacked areas of publications by year ask the server for
 * the same counts, so switching between them draws the new form at once. The
 * play test checks that each switch writes the address with `ADDRESS.replace`,
 * that `router.replace` is not called, and that the new form is drawn.
 */
export const DrawingTheSameCounts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chart = () =>
      canvas.getByRole("region", {
        name: "Publications by year and leading countries",
      });

    await pick(canvasElement, "Show as", "as lines");

    await expect(replaceAddress).toHaveBeenLastCalledWith(
      "/insights?count=publications&by=year&split=country&form=lines",
    );
    await expect(canvas.getByLabelText("Preset")).toHaveValue("Custom");
    await expect(chart().querySelectorAll("polyline")).toHaveLength(3);

    await pick(canvasElement, "Show as", "as stacked area");

    await expect(replaceAddress).toHaveBeenLastCalledWith(
      "/insights?count=publications&by=year&split=country&form=area",
    );
    await expect(chart().querySelectorAll("polygon")).toHaveLength(3);

    await expect(getRouter().replace).not.toHaveBeenCalled();
  },
};

/**
 * Ranked groups in bars enable the controls for how many groups to keep and
 * how many items each needs. The play test keeps every author, which writes
 * no `top` to the address.
 */
export const RankedGroups: Story = {
  args: {
    description: preset("leadingAuthors"),
    drawn: CHARTS.leadingAuthors,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("How many groups")).toHaveValue(
      "Top 10",
    );
    await expect(canvas.getByLabelText("How many groups")).toBeEnabled();
    await expect(canvas.getByLabelText("Fewest items per group")).toHaveValue(
      "Any size",
    );

    await pick(canvasElement, "How many groups", "All");

    await expect(getRouter().replace).toHaveBeenLastCalledWith(
      "/insights?count=publications&by=original_author&form=bars",
      { scroll: false },
    );
  },
};

/**
 * A map shows every country, so how many groups to keep and how many items
 * each needs are disabled. It draws no series, so its split is disabled too.
 * Only publications are grouped by country, so counting works instead groups
 * them by year, at their first appearance, in columns, and the play test
 * checks the address it writes.
 */
export const Map: Story = {
  args: {
    description: preset("countriesOfPublication"),
    drawn: CHARTS.countriesOfPublication,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("How many groups")).toBeDisabled();
    await expect(
      canvas.getByLabelText("Fewest items per group"),
    ).toBeDisabled();
    await expect(canvas.getByLabelText("Split by")).toBeDisabled();

    await pick(canvasElement, "What to count", "Works");

    await expect(getRouter().replace).toHaveBeenLastCalledWith(
      "/insights?count=works&by=year&form=columns",
      { scroll: false },
    );
  },
};

/**
 * A count other than publications takes no split, so the split is disabled,
 * and the chart is no preset, so the preset select shows "Custom". The play
 * test checks that the counts offered leave out countries.
 */
export const OtherCounts: Story = {
  args: {
    description: {
      count: "works",
      by: "year",
      split: null,
      form: "running",
      top: null,
      least: null,
    },
    drawn: CHARTS.worksByYear,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("Split by")).toBeDisabled();
    await expect(canvas.getByLabelText("Preset")).toHaveValue("Custom");

    await userEvent.click(canvas.getByLabelText("What to count"));

    const options = await screen.findAllByRole("option");

    await expect(options.map((option) => option.textContent)).toEqual([
      "Publications",
      "Works",
      "Translations",
      "Original authors",
      "Translators",
      "Publishers",
    ]);

    await userEvent.keyboard("{Escape}");
  },
};

/**
 * Shares need a split, and kinds are not split by kind, so choosing shares for
 * publications by kind splits them by country. The play test checks the
 * address it writes.
 */
export const SharesOfKinds: Story = {
  args: {
    description: {
      count: "publications",
      by: "kind",
      split: null,
      form: "bars",
      top: null,
      least: null,
    },
    drawn: {
      series: [null],
      groups: [
        { key: "first_translation", total: 300, counts: [300] },
        { key: "retranslation", total: 40, counts: [40] },
        { key: "reissue", total: 88, counts: [88] },
      ],
      hidden: 0,
    },
  },
  play: async ({ canvasElement }) => {
    await pick(canvasElement, "Show as", "as shares");

    await expect(getRouter().replace).toHaveBeenLastCalledWith(
      "/insights?count=publications&by=kind&split=country&form=shares",
      { scroll: false },
    );
  },
};

/**
 * The view buttons switch between the chart and a table of its counts, without
 * changing the address.
 */
export const TableView: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const shown = () =>
      canvas
        .getByRole("table", { name: "Publications per year" })
        .closest("[data-shown]");

    await expect(shown()).toHaveAttribute("data-shown", "false");

    await userEvent.click(canvas.getByRole("button", { name: "Table" }));

    await expect(shown()).toHaveAttribute("data-shown", "true");
    await expect(canvas.getByRole("button", { name: "Table" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};

/**
 * Groups by year are not ranked, so how many groups to keep and how many items
 * each needs are disabled, and they keep their places in the title row.
 */
export const UnrankedGroups: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("How many groups")).toBeDisabled();
    await expect(
      canvas.getByLabelText("Fewest items per group"),
    ).toBeDisabled();
  },
};

/**
 * Original authors are grouped only by time, at their first appearance, and by
 * the translators and publishers of their publications. A country and a kind
 * belong to a publication, and a work or a pair is made of its authors. The
 * play test opens the grouping and checks its options.
 */
export const OwnGroupings: Story = {
  args: { description: preset("debuts"), drawn: CHARTS.debuts },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByLabelText("Group by"));

    const options = await screen.findAllByRole("option");

    await expect(options.map((option) => option.textContent)).toEqual([
      "by year",
      "by decade",
      "by translator",
      "by publisher",
    ]);

    await userEvent.keyboard("{Escape}");
  },
};
