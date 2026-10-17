import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { skeletonAppeared, skeletonRows } from "test/skeleton";

import {
  Skeleton,
  SkeletonBar,
  skeletonRow,
  type SkeletonLength,
} from "./Skeleton";

const LENGTHS: SkeletonLength[] = ["short", "medium", "long", "full"];

/** The length of the line in each row of the `Wave` story. */
const WAVE: SkeletonLength[] = [
  "long",
  "full",
  "medium",
  "long",
  "short",
  "full",
];

const meta = {
  title: "Components/Skeleton",
  component: Skeleton,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Every shape: a line at each length, a muted line, a pill at each length and
 * a button. The play test checks that the shapes sit in a status named
 * "Loading" and are hidden from assistive technology, and that the status
 * fades in after a delay and has a mask.
 */
export const Shapes: Story = {
  args: {
    children: (
      <div className="space-y-3 w-96">
        {LENGTHS.map((length) => (
          <SkeletonBar key={length} length={length} />
        ))}
        <SkeletonBar length="long" muted />
        <div className="flex gap-1">
          {LENGTHS.slice(0, 3).map((length) => (
            <SkeletonBar key={length} shape="pill" length={length} />
          ))}
        </div>
        <SkeletonBar shape="button" length="medium" />
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole("status", {
      name: "Loading",
    });
    const style = getComputedStyle(status);

    await expect(status.firstElementChild).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(style.animationName).toBe("skeleton-appear");
    await expect(style.animationDelay).toBe("0.15s");
    await expect(style.animationFillMode).toBe("both");
    await expect(style.maskImage).toContain("linear-gradient");
    await skeletonAppeared(status);
  },
};

/**
 * Six rows of lines, each row with its index in `--row`, so the pulse moves
 * down the rows. The play test checks that each row's shapes start their pulse
 * 90ms after the row above, or that they are still when the browser asks for
 * reduced motion.
 */
export const Wave: Story = {
  args: {
    children: (
      <div className="space-y-3 w-96">
        {WAVE.map((length, index) => (
          <div key={index} style={skeletonRow(index)}>
            <SkeletonBar length={length} />
          </div>
        ))}
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole("status", {
      name: "Loading",
    });
    const rows = skeletonRows(status);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    await expect(rows).toHaveLength(6);
    for (const [index, row] of rows.entries()) {
      const bar = getComputedStyle(row.firstElementChild as Element);

      await expect(row.style.getPropertyValue("--row")).toBe(String(index));
      if (still) {
        await expect(bar.animationName).toBe("none");
      } else {
        await expect(bar.animationName).toBe("skeleton-pulse");
        await expect(bar.animationDelay).toBe(`${(index * 90) / 1000}s`);
      }
    }
    await skeletonAppeared(status);
  },
};
