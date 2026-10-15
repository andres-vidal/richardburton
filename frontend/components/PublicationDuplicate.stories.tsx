import type { Meta, StoryObj } from "@storybook/react";
import { publicationIdsAtom } from "modules/publication/store";
import { getSelection, select } from "modules/selection";
import { store } from "modules/store";
import { seed } from "test/publication-fixtures";
import { expect, userEvent, within } from "storybook/test";

import PublicationDuplicate from "./PublicationDuplicate";

const meta = {
  title: "Publications/Publication duplicate",
  component: PublicationDuplicate,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationDuplicate>;

export default meta;

type Story = StoryObj<typeof meta>;

/** With nothing selected, the button reads "Duplicate 0" and a click copies nothing. */
export const Default: Story = {
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    const before = store.get(publicationIdsAtom) ?? [];

    await userEvent.click(
      within(canvasElement).getByRole("button", { name: /Duplicate 0/ }),
    );

    await expect(store.get(publicationIdsAtom)).toEqual(before);
  },
};

/**
 * Two rows are selected, so the button reads "Duplicate 2". The play test
 * checks that a click puts a copy right after each of the two rows and clears
 * the selection.
 */
export const TwoRowsSelected: Story = {
  beforeEach: () => {
    seed(store);
    const [first, second] = store.get(publicationIdsAtom) ?? [];

    select(store, { id: first, type: "publication" });
    select(store, { id: second, type: "publication", metaKey: true });
  },
  play: async ({ canvasElement }) => {
    const [first, second, third] = store.get(publicationIdsAtom) ?? [];

    await userEvent.click(
      within(canvasElement).getByRole("button", { name: /Duplicate 2/ }),
    );

    const after = store.get(publicationIdsAtom) ?? [];
    await expect(after).toHaveLength(5);
    await expect([after[0], after[2], after[4]]).toEqual([
      first,
      second,
      third,
    ]);
    await expect(getSelection(store).size).toBe(0);
  },
};
