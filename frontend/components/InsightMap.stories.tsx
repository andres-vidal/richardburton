import type { Meta, StoryObj } from "@storybook/react";
import { CHARTS } from "test/insights-fixtures";
import { worldMap } from "modules/world-map";
import { NUMERIC_CODES } from "test/messages";
import { expect, userEvent, waitFor, within } from "storybook/test";

import InsightMap from "./InsightMap";

const NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  BR: "Brazil",
};

const meta = {
  title: "Insights/Insight map",
  component: InsightMap,
  args: {
    map: worldMap(NUMERIC_CODES),
    countries: CHARTS.countriesOfPublication.groups
      .slice(0, 4)
      .map(({ key, total }) => ({
        code: String(key),
        name: NAMES[String(key)] ?? String(key),
        count: total,
      })),
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightMap>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The four leading countries of the fixtures, shaded by band: the United States and the
 * United Kingdom with over 100 publications, Canada with ten to 99, and
 * Australia with two to nine. The list beside the map has every country with
 * its count.
 */
export const Countries: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([
      "United States259",
      "United Kingdom143",
      "Canada11",
      "Australia5",
    ]);

    // One shape for each country with publications is shaded, by its band.
    const shaded = canvasElement.querySelectorAll("path[data-shade]");
    await expect(
      [...shaded].map((path) => path.getAttribute("data-shade")).sort(),
    ).toEqual(["2", "3", "4", "4"]);
  },
};

/**
 * A single publication shades its country with the lightest band. The shades
 * are fixed bands, so the shade means the same on every search.
 */
export const OnePublication: Story = {
  args: { countries: [{ code: "BR", name: "Brazil", count: 1 }] },
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelectorAll('path[data-shade="1"]'),
    ).toHaveLength(1);
  },
};

/**
 * Hovering a country on the map highlights its entry in the list, and hovering
 * an entry in the list darkens its country on the map.
 */
export const HoverLinksMapAndList: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const unitedStates = canvasElement.querySelector(
      'path[data-code="US"]',
    ) as SVGPathElement;
    const canada = canvas
      .getAllByRole("listitem")
      .find((item) => item.textContent?.startsWith("Canada")) as HTMLElement;

    await userEvent.hover(unitedStates);
    await waitFor(() =>
      expect(
        canvas
          .getAllByRole("listitem")
          .find((item) => item.dataset.active === "true"),
      ).toHaveTextContent("United States259"),
    );

    await userEvent.hover(canada);
    await waitFor(() =>
      expect(
        canvasElement.querySelector('path[data-code="CA"]'),
      ).toHaveAttribute("data-active", "true"),
    );
    await expect(unitedStates).toHaveAttribute("data-active", "false");
  },
};
