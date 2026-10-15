import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { fieldErrors, seed } from "test/publication-fixtures";
import { areRowIdsVisibleAtom } from "modules/publication/store";
import {
  expect,
  fireEvent,
  screen,
  userEvent,
  waitFor,
  within,
} from "storybook/test";

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

/** The editable table: a field in every cell, and the draft row at the end. */
export const Default: Story = {
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // header + 3 seeded rows + the always-present new-publication row.
    await expect(canvas.getAllByRole("row")).toHaveLength(5);
  },
};

/**
 * The draft row shows what is typed into it. It renders through the table's
 * own `Column`, so the play test checks that cell holds a field.
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

/** A row with errors on its title and year marks those two fields invalid. */
export const WithInvalidRow: Story = {
  beforeEach: () =>
    seed(store, [
      { title: "Dom Casmurro", authors: ["Helen Caldwell"], year: "1953" },
      {
        title: "",
        year: "MCMLXI",
        errors: fieldErrors({ title: "required", year: "integer" }),
      },
    ]),
  play: async ({ canvasElement }) => {
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
 * The handle's own content — a row number, an error icon — is part of the
 * handle: clicking it selects the row like clicking around it does.
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
 * hears every click inside it — and does not turn it into a selection.
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
 * A cell holds no copy of its value: typing writes to the row with
 * `setField`, and the field reads the row back. The play test retypes a title.
 */
export const EditCell: Story = {
  beforeEach: () =>
    seed(store, [
      { title: "Dom Casmurro", authors: ["Helen Caldwell"], year: "1953" },
    ]),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A row renders its fields once it is in view, so the field is awaited.
    const title = await canvas.findByDisplayValue("Dom Casmurro");

    await userEvent.clear(title);
    await userEvent.type(title, "The Posthumous Memoirs");

    await waitFor(() => expect(title).toHaveValue("The Posthumous Memoirs"));
  },
};

/**
 * With row ids shown, each row's number is its position in the workspace,
 * counting from 1. The row's key cannot be used for this: an unsaved row is
 * keyed by a UUID and a saved row by its server id, and neither gives the
 * row's position.
 */
export const RowNumbers: Story = {
  beforeEach: () => {
    seed(store, [
      { title: "Dom Casmurro", year: "1953" },
      { title: "Iracema", year: "1886" },
      { title: "Barren Lives", year: "1965" },
    ]);
    store.set(areRowIdsVisibleAtom, true);
  },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll("[data-selects-row=true]").length,
      ).toBe(3),
    );

    const numbers = Array.from(
      canvasElement.querySelectorAll("[data-selects-row=true]"),
    ).map((cell) => cell.textContent?.trim());

    await expect(numbers).toEqual(["1", "2", "3"]);
  },
};

/** Enter in a field of the draft row adds the row to the table. */
export const EnterAddsTheRow: Story = {
  beforeEach: () => seed(store, []),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(
      await canvas.findByPlaceholderText("Title"),
      "Dom Casmurro{Enter}",
    );

    // The header, the added row and a new, empty draft row.
    await waitFor(() => expect(canvas.getAllByRole("row")).toHaveLength(3));
  },
};

/**
 * Enter that picks an option in a combobox of the draft row belongs to the
 * combobox, and does not add the row. The play test picks a country with Enter,
 * and then adds the row with Enter in the emptied field.
 */
export const EnterThatPicksAnOptionStaysInTheField: Story = {
  beforeEach: () => seed(store, []),
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const countries = await canvas.findByPlaceholderText("Countries");

    await userEvent.type(countries, "Brazil");
    await screen.findByRole("option", { name: "Brazil" });
    await userEvent.keyboard("{Enter}");

    await expect(await canvas.findByText("Brazil")).toBeInTheDocument();
    await expect(canvas.getAllByRole("row")).toHaveLength(2);

    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.getAllByRole("row")).toHaveLength(3));
  },
};
