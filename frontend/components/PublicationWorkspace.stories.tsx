import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
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
  beforeEach: () => seed(store),
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
  beforeEach: () => seed(store, []),
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
    seed(store, [
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

/** Skip the header; the seeded rows follow, and the new-publication row trails. */
const rowsIn = (canvas: ReturnType<typeof within>) =>
  canvas.getAllByRole("row").slice(1);

/**
 * A row's selection handle — its leading cell. Rows render placeholder cells until
 * they scroll into view, so a story has to wait for the real ones before it can
 * click them.
 */
const handleIn = async (row: HTMLElement) => {
  await waitFor(() =>
    expect(row.querySelector('[data-selects-row="true"]')).not.toBeNull(),
  );
  return row.querySelector('[data-selects-row="true"]') as HTMLElement;
};

const selectedCount = (canvas: ReturnType<typeof within>) =>
  canvas
    .getAllByRole("row")
    .filter((row: HTMLElement) => row.querySelector('[data-selected="true"]'))
    .length;

/**
 * Multi-select from the row handles: a plain click selects one row, shift-click
 * extends a contiguous range from it, and cmd/ctrl-click toggles a single row.
 * Selected rows carry `data-selected` on their (amber) signal cell.
 */
export const Selection: Story = {
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [first, second, third] = rowsIn(canvas);

    // Plain click selects just that row.
    fireEvent.click(await handleIn(first));
    await waitFor(() => expect(selectedCount(canvas)).toBe(1));

    // Shift-click extends the contiguous range from the first row through it.
    fireEvent.click(await handleIn(third), { shiftKey: true });
    await waitFor(() => expect(selectedCount(canvas)).toBe(3));

    // Cmd/ctrl-click toggles a single row out of the range.
    fireEvent.click(await handleIn(second), { metaKey: true });
    await waitFor(() => expect(selectedCount(canvas)).toBe(2));
  },
};

/**
 * The handle's own content — a row number, an error icon — is part of the handle:
 * clicking it selects the row like clicking around it does. Selecting used to
 * depend on the click *missing* that content.
 */
export const SelectionFromTheHandleContent: Story = {
  beforeEach: () =>
    seed(store, [{ title: "Dom Casmurro", errors: "conflict" }]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [row] = rowsIn(canvas);

    // The invalid row's handle draws an icon, which covers its middle.
    const icon = (await handleIn(row)).querySelector("span") as HTMLElement;
    fireEvent.click(icon);

    await waitFor(() => expect(selectedCount(canvas)).toBe(1));
  },
};

/**
 * A click that lands in a field belongs to the field. The row hears it too — it
 * hears every click inside it — and must not turn it into a selection, or typing
 * would swap the submit bar for the selection toolbar.
 */
export const TypingDoesNotSelect: Story = {
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [row] = rowsIn(canvas);

    // Wait for the row to render for real, then click into one of its fields.
    await handleIn(row);
    const input = row.querySelector("input") as HTMLElement;
    fireEvent.click(input);
    await userEvent.type(input, "x");

    await expect(selectedCount(canvas)).toBe(0);
  },
};

/**
 * Editing a cell round-trips through the store: the cell input has no local
 * mirror, so what you type only shows up if `overrideField` writes it and the
 * value flows back through `usePublicationField`.
 */
export const EditCell: Story = {
  beforeEach: () =>
    seed(store, [
      { title: "Dom Casmurro", authors: "Helen Caldwell", year: "1953" },
    ]),
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
