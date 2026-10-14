import type { Meta, StoryObj } from "@storybook/react";
import { CSSProperties } from "react";
import { expect, within } from "storybook/test";

import InsightAxis from "./InsightAxis";

// Returns every year from `first` to `last`, `step` years apart.
const span = (first: number, last: number, step = 1) =>
  Array.from(
    { length: (last - first) / step + 1 },
    (_, index) => first + index * step,
  );

const DECADES = span(1880, 2020, 10);

const meta = {
  title: "Insights/Insight axis",
  component: InsightAxis,
  args: {
    ats: span(1946, 2026),
    top: "24",
    children: <div className="bg-indigo-50 size-full" />,
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightAxis>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Every year from 1946 to 2026 under a shaded plot, with 24 written at the
 * top. The play test checks which years are labelled always, which only on
 * wider screens, and which never.
 */
export const Years: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("24")).toBeInTheDocument();
    await expect(canvas.getByText("1960")).toHaveAttribute(
      "data-tick",
      "major",
    );
    await expect(canvas.getByText("1950")).toHaveAttribute(
      "data-tick",
      "minor",
    );
    await expect(canvas.getByText("1951")).not.toHaveAttribute("data-tick");
  },
};

/**
 * The decades from 1880 to 2020 under columns that are one pixel apart. With
 * `spaced`, the slots under the plot are one pixel apart too, so each label
 * is centred under its column.
 */
export const Spaced: Story = {
  args: {
    ats: DECADES,
    top: "100%",
    spaced: true,
    children: (
      <div className="flex gap-px items-end h-full">
        {DECADES.map((at, index) => (
          <span
            key={at}
            style={{ "--share": ((index % 5) + 1) / 5 } as CSSProperties}
            className="flex-1 h-[calc(var(--share)*100%)] bg-indigo-400"
          />
        ))}
      </div>
    ),
  },
};
