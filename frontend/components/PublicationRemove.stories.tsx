import type { Meta, StoryObj } from "@storybook/react";
import { publicationIdsAtom } from "modules/publication/store";
import { getSelection, select } from "modules/selection";
import { store } from "modules/store";
import { seed } from "test/publication-fixtures";
import { expect, userEvent, within } from "storybook/test";

import PublicationRemove from "./PublicationRemove";

const meta = {
  title: "Publications/Publication remove",
  component: PublicationRemove,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationRemove>;

export default meta;

type Story = StoryObj<typeof meta>;

/** With nothing selected, the button reads "Remove 0" and a click does nothing. */
export const NothingSelected: Story = {
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    const before = store.get(publicationIdsAtom) ?? [];

    await userEvent.click(
      within(canvasElement).getByRole("button", { name: /Remove 0/ }),
    );

    await expect(store.get(publicationIdsAtom)).toEqual(before);
  },
};

/**
 * With two rows selected, the button reads "Remove 2". The play test checks
 * that a click removes those two rows, keeps the others, and clears the
 * selection.
 */
export const TwoRowsSelected: Story = {
  beforeEach: () => {
    seed(store);
    const [first, second] = store.get(publicationIdsAtom) ?? [];

    select(store, { id: first, type: "publication" });
    select(store, { id: second, type: "publication", metaKey: true });
  },
  play: async ({ canvasElement }) => {
    const [first, second, ...rest] = store.get(publicationIdsAtom) ?? [];

    await userEvent.click(
      within(canvasElement).getByRole("button", { name: /Remove 2/ }),
    );

    const after = store.get(publicationIdsAtom) ?? [];
    await expect(after).toEqual(rest);
    await expect(after).not.toContain(first);
    await expect(after).not.toContain(second);
    await expect(getSelection(store).size).toBe(0);
  },
};
