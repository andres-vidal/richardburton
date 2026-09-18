import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import Highlight from "./Highlight";

const meta = {
  title: "Components/Highlight",
  component: Highlight,
} satisfies Meta<typeof Highlight>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Text the search did not match carries no marks, and reads as it is stored. */
export const Unmatched: Story = {
  args: { children: "Dom Casmurro" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("mark")).toBeNull();
    await expect(within(canvasElement).getByText("Dom Casmurro")).toBeVisible();
  },
};

/** The marked word is picked out; the rest of the excerpt is not. */
export const Matched: Story = {
  args: { children: "Dom [[Casmurro]]" },
  play: async ({ canvasElement }) => {
    const marks = canvasElement.querySelectorAll("mark");
    await expect(marks).toHaveLength(1);
    await expect(marks[0]).toHaveTextContent("Casmurro");
  },
};

/** An excerpt can carry several marks, and every one of them is rendered. */
export const ManyMatches: Story = {
  args: { children: "[[Machado]] de [[Assis]], by [[Machado]] de [[Assis]]" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("mark")).toHaveLength(4);
  },
};

/**
 * The index folds accents away when it matches, and marks the word as it is
 * actually written — so a term typed without them still marks the accented word.
 */
export const Accented: Story = {
  args: { children: "[[Angústia]]" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("mark")).toHaveTextContent(
      "Angústia",
    );
  },
};

/** The caller can ask for a different mark, as the sources line does. */
export const Restyled: Story = {
  args: {
    children: "Austin: University of [[Texas]] Press, 1963.",
    className: "text-gray-700 bg-amber-100",
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("mark")).toHaveClass(
      "bg-amber-100",
    );
  },
};
