import type { Meta, StoryObj } from "@storybook/react";
import { PRESETS, type Description } from "modules/chart";
import { worldMap } from "modules/world-map";
import { WorldMapProvider } from "modules/world-map-provider";
import { CHARTS } from "test/insights-fixtures";
import { NUMERIC_CODES } from "test/messages";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import InsightChart from "./InsightChart";

// Returns the description of the preset named `name`.
const preset = (name: string) =>
  PRESETS.find((each) => each.name === name)!.description;

// Returns a description that is no preset, from the fields it sets.
const custom = (fields: Partial<Description>): Description => ({
  count: "publications",
  by: "year",
  split: null,
  form: "columns",
  top: null,
  least: null,
  ...fields,
});

const meta = {
  title: "Insights/Insight chart",
  component: InsightChart,
  args: {
    description: preset("perYear"),
    drawn: CHARTS.perYear,
    view: "chart",
  },
  decorators: [
    (Story) => (
      <WorldMapProvider map={worldMap(NUMERIC_CODES)}>
        <Story />
      </WorldMapProvider>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightChart>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The first preset: publications per year, split by the two leading countries,
 * named in the reader's language, and every other country. It has the
 * preset's title and hint.
 */
export const PerYear: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole("region", {
      name: "Publications per year",
    });

    await expect(
      within(region)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["United States", "United Kingdom", "Elsewhere"]);

    await userEvent.hover(
      canvas.getByRole("button", { name: "About Publications per year" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("tooltip")).toHaveTextContent(
        "Each column counts the publications of one year",
      ),
    );
  },
};

/** Publications per decade by kind, as stacked bars named by decade. */
export const ByDecade: Story = {
  args: { description: preset("byDecade"), drawn: CHARTS.byDecade },
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole("table", {
      name: "Publications by decade",
    });

    await expect(
      within(table).getByRole("row", { name: /^1960s/ }),
    ).toHaveTextContent("1960s161421");
  },
};

/**
 * The ten most translated authors, as bars. Under the list, it says how many
 * authors `top` left out.
 */
export const LeadingAuthors: Story = {
  args: { description: preset("leadingAuthors"), drawn: CHARTS.leadingAuthors },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      within(
        canvas.getByRole("region", { name: "Most translated authors" }),
      ).getAllByRole("listitem")[0],
    ).toHaveTextContent("Clarice Lispector35");
    await expect(
      canvas.getByText("148 more are not shown."),
    ).toBeInTheDocument();
  },
};

/** Original authors, each counted in the decade of their first publication. */
export const Debuts: Story = {
  args: { description: preset("debuts"), drawn: CHARTS.debuts },
  play: async ({ canvasElement }) => {
    await expect(
      within(
        within(canvasElement).getByRole("region", {
          name: "Authors first translated, by decade",
        }),
      ).getAllByRole("listitem")[0],
    ).toHaveTextContent("1880s3");
  },
};

/**
 * The ten translators with the most publications, on a timeline. A dot names
 * the titles of a year with few publications, and counts them otherwise.
 */
export const LeadingTranslators: Story = {
  args: {
    description: preset("leadingTranslators"),
    drawn: CHARTS.leadingTranslators,
  },
  play: async ({ canvasElement }) => {
    const first = within(
      within(canvasElement).getByRole("region", {
        name: "Translators with the most publications",
      }),
    ).getAllByRole("listitem")[0];

    await expect(first).toHaveTextContent(
      /^Clifford E. Landers25 publications/,
    );
    await expect(first).toHaveTextContent("1990 · Bufo and Spallanzani");
  },
};

/** The ten pairs of an original author and a translator, with the translator as the detail. */
export const Pairs: Story = {
  args: { description: preset("pairs"), drawn: CHARTS.pairs },
  play: async ({ canvasElement }) => {
    await expect(
      within(
        within(canvasElement).getByRole("region", {
          name: "Most frequent author–translator pairs",
        }),
      ).getAllByRole("listitem")[0],
    ).toHaveTextContent("Paulo Coelho · Margaret Jull Costa17");
  },
};

/**
 * The works with the most translations, on a timeline with a dot for each
 * translation, named by its translators.
 */
export const Retranslated: Story = {
  args: { description: preset("retranslated"), drawn: CHARTS.retranslated },
  play: async ({ canvasElement }) => {
    const first = within(
      within(canvasElement).getByRole("region", {
        name: "Works translated more than once",
      }),
    ).getAllByRole("listitem")[0];

    await expect(first).toHaveTextContent(
      /^Dom Casmurro · Machado de Assis3 translations/,
    );
    await expect(first).toHaveTextContent("1953 · Helen Caldwell");
  },
};

/** The ten publishers with the most publications, as bars. */
export const LeadingPublishers: Story = {
  args: {
    description: preset("leadingPublishers"),
    drawn: CHARTS.leadingPublishers,
  },
};

/** Every country of publication on a map, named in the reader's language. */
export const Countries: Story = {
  args: {
    description: preset("countriesOfPublication"),
    drawn: CHARTS.countriesOfPublication,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(
        within(canvasElement).getByRole("region", {
          name: "Publications by country",
        }),
      ).getAllByRole("listitem")[0],
    ).toHaveTextContent("United States259");
  },
};

/**
 * A chart that is no preset: works by year. Works are placed in time at their
 * first appearance, so the title says so, and the hint says what a work and a
 * first appearance are.
 */
export const NewWorks: Story = {
  args: {
    description: custom({ count: "works" }),
    drawn: CHARTS.worksByYear,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = "Works by year, first appearances only";

    await expect(canvas.getByRole("region", { name })).toBeInTheDocument();
    await userEvent.hover(
      canvas.getByRole("button", { name: `About ${name}` }),
    );
    await waitFor(() =>
      expect(screen.getByRole("tooltip")).toHaveTextContent(
        "where it first appears in the database",
      ),
    );
  },
};

/** The running total of works, each counted in the year it first appears. */
export const RunningTotal: Story = {
  args: {
    description: custom({ count: "works", form: "running" }),
    drawn: CHARTS.worksByYear,
  },
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole("table", {
      name: "Works by year, running total",
    });

    await expect(
      within(table).getByRole("row", { name: /^2026/ }),
    ).toHaveTextContent("2026323");
  },
};

/** The ten leading original authors in a heat table by decade. */
export const Heat: Story = {
  args: {
    description: custom({ by: "original_author", form: "heat", top: 10 }),
    drawn: CHARTS.authorsByDecade,
  },
};

/** The counts of the first preset shown as a table rather than a chart. */
export const Table: Story = {
  args: { view: "table" },
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole("table", {
      name: "Publications per year",
    });

    await expect(table.closest("[data-shown]")).toHaveAttribute(
      "data-shown",
      "true",
    );
    await expect(within(table).getAllByRole("columnheader")).toHaveLength(5);
  },
};

/** A chart with no groups, such as one that asks for too many items. */
export const Empty: Story = {
  args: {
    description: custom({
      count: "works",
      by: "translator",
      form: "bars",
      least: 10,
    }),
    drawn: { series: [null], groups: [], hidden: 0 },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Nothing to show with these settings."),
    ).toBeInTheDocument();
  },
};
