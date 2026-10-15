import type { Meta, StoryObj } from "@storybook/react";
import { publicationIdsAtom } from "modules/publication/store";
import { getSelection, select } from "modules/selection";
import { store } from "modules/store";
import { seed } from "test/publication-fixtures";
import { expect, userEvent, waitFor, within } from "storybook/test";

import PublicationDeselect from "./PublicationDeselect";

const meta = {
  title: "Publications/Publication deselect",
  component: PublicationDeselect,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationDeselect>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Two rows are selected, so the button reads "Deselect 2". The play test
 * clicks it and checks that the selection is empty.
 */
export const TwoRowsSelected: Story = {
  beforeEach: () => {
    seed(store);
    const [first, second] = store.get(publicationIdsAtom) ?? [];

    select(store, { id: first, type: "publication" });
    select(store, { id: second, type: "publication", metaKey: true });
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Deselect 2" }),
    );

    await waitFor(() => expect(getSelection(store).size).toBe(0));
  },
};
