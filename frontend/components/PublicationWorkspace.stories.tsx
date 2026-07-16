import type { Meta, StoryObj } from "@storybook/react";
import { fieldErrors, seed } from "modules/publication/fixtures";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";

import PublicationWorkspace from "./PublicationWorkspace";

const meta = {
  title: "Publications/Workspace",
  component: PublicationWorkspace,
  decorators: [
    (Story) => (
      <div className="overflow-x-auto p-4">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PublicationWorkspace>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The editable review table — an inline input per cell, plus the "new row". */
export const Default: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // header + 3 seeded rows + the always-present new-publication row.
    await expect(canvas.getAllByRole("row")).toHaveLength(5);
  },
};

/**
 * The new-publication row is an editing surface too, so typing into it must
 * stick. It renders through the *base* `Column` (not the workspace's extended
 * one), so a table that reads stored values by default would leave this row
 * permanently empty — seeded rows would keep working and hide it.
 */
export const NewRowAcceptsInput: Story = {
  beforeEach: () => seed([]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = await canvas.findByPlaceholderText("Title");

    await userEvent.type(title, "Dom Casmurro");
    await waitFor(() => expect(title).toHaveValue("Dom Casmurro"));
  },
};

/** Field-level validation errors — the title and year cells are flagged. */
export const WithInvalidRow: Story = {
  beforeEach: () =>
    seed([
      { title: "Dom Casmurro", authors: "Helen Caldwell", year: "1953" },
      {
        title: "",
        year: "MCMLXI",
        errors: fieldErrors({ title: "required", year: "integer" }),
      },
    ]),
  play: async ({ canvasElement }) => {
    // The flagged fields mark their inputs invalid (red cell + aria-invalid);
    // the valid row and the new row don't.
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll('[aria-invalid="true"]').length,
      ).toBeGreaterThan(0),
    );
  },
};

/**
 * Multi-select: a plain click selects one row, shift-click extends a contiguous
 * range from it, and cmd/ctrl-click toggles a single row. Selected rows carry
 * `data-selected` on their (amber) signal cell.
 */
export const Selection: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Skip the header; the three seeded rows (the new-publication row trails).
    const [, first, second, third] = canvas.getAllByRole("row");

    const selectedCount = () =>
      canvas
        .getAllByRole("row")
        .filter((row) => row.querySelector('[data-selected="true"]')).length;

    // Plain click selects just that row.
    fireEvent.click(first);
    await waitFor(() => expect(selectedCount()).toBe(1));

    // Shift-click extends the contiguous range from the first row through it.
    fireEvent.click(third, { shiftKey: true });
    await waitFor(() => expect(selectedCount()).toBe(3));

    // Cmd/ctrl-click toggles a single row out of the range.
    fireEvent.click(second, { metaKey: true });
    await waitFor(() => expect(selectedCount()).toBe(2));
  },
};

/**
 * Editing a cell round-trips through the store: the cell input has no local
 * mirror, so what you type only shows up if `overrideField` writes it and the
 * value flows back through `usePublicationField`.
 */
export const EditCell: Story = {
  beforeEach: () =>
    seed([{ title: "Dom Casmurro", authors: "Helen Caldwell", year: "1953" }]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // findBy*: the row virtualizes on an IntersectionObserver, so its input
    // isn't in the DOM until the row is scrolled into view / observed visible.
    const title = await canvas.findByDisplayValue("Dom Casmurro");

    await userEvent.clear(title);
    await userEvent.type(title, "The Posthumous Memoirs");

    await waitFor(() => expect(title).toHaveValue("The Posthumous Memoirs"));
  },
};
