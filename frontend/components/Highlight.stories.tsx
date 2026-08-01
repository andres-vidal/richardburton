import type { Meta, StoryObj } from "@storybook/react";
import { keywordsAtom } from "modules/publication/store";
import { store } from "modules/store";
import { expect, within } from "storybook/test";

import Highlight from "./Highlight";

/** Seed the words the current search matched on, as an index read would. */
const matching = (...keywords: string[]) => {
  store.set(keywordsAtom, keywords);
  return () => store.set(keywordsAtom, undefined);
};

const meta = {
  title: "Components/Highlight",
  component: Highlight,
  // Falls back to the term in the address when the store holds no keywords.
  parameters: { nextjs: { navigation: { pathname: "/" } } },
} satisfies Meta<typeof Highlight>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Outside a search nothing is marked, and the text reads as it always did. */
export const Unsearched: Story = {
  args: { children: "Dom Casmurro" },
  beforeEach: () => matching(),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("mark")).toBeNull();
    await expect(within(canvasElement).getByText("Dom Casmurro")).toBeVisible();
  },
};

/** The word the search matched is picked out; the rest of the text is not. */
export const Matched: Story = {
  args: { children: "Dom Casmurro" },
  beforeEach: () => matching("casmurro"),
  play: async ({ canvasElement }) => {
    const marks = canvasElement.querySelectorAll("mark");
    await expect(marks).toHaveLength(1);
    await expect(marks[0]).toHaveTextContent("Casmurro");
  },
};

/** Every occurrence is marked, and several keywords can match at once. */
export const ManyMatches: Story = {
  args: { children: "Machado de Assis, by Machado de Assis" },
  beforeEach: () => matching("machado", "assis"),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("mark")).toHaveLength(4);
  },
};

/**
 * The index folds accents away, so a term typed without them still marks the
 * word that carries them.
 */
export const Accented: Story = {
  args: { children: "Angústia" },
  beforeEach: () => matching("angustia"),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("mark")).toHaveTextContent(
      "Angústia",
    );
  },
};
