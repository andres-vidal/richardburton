import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { areRowIdsVisibleAtom, resetAll } from "modules/publication/store";
import { seed } from "test/publication-fixtures";
import { expect, userEvent, waitFor, within } from "storybook/test";

import RowIdToggle from "./RowIdToggle";

const meta = {
  title: "Publications/Row id toggle",
  component: RowIdToggle,
  parameters: { layout: "centered" },
} satisfies Meta<typeof RowIdToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * With rows in the workspace, the toggle shows. The play test checks that a
 * click shows the row numbers and a second click hides them.
 */
export const Default: Story = {
  beforeEach: () => {
    seed(store);
    store.set(areRowIdsVisibleAtom, false);
  },
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole("button", {
      name: "Row Ids",
    });

    await userEvent.click(toggle);
    await waitFor(() => expect(store.get(areRowIdsVisibleAtom)).toBe(true));

    await userEvent.click(toggle);
    await waitFor(() => expect(store.get(areRowIdsVisibleAtom)).toBe(false));
  },
};

/** With nothing loaded, the toggle hides itself entirely. */
export const Empty: Story = {
  beforeEach: () => resetAll(store),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};
