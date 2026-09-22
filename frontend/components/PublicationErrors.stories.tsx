import type { Meta, StoryObj } from "@storybook/react";
import { fieldErrors, seed } from "modules/publication/fixtures";
import { focusedRowIdAtom } from "modules/publication/store";
import { store } from "modules/store";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import PublicationErrors from "./PublicationErrors";

// A set as it comes back from a spreadsheet: one row good, one missing what it
// needs, one refused as a whole rather than field by field.
const ROWS = [
  {
    title: "Dom Casmurro",
    originalTitle: "Dom Casmurro",
    authors: ["Helen Caldwell"],
    originalAuthors: ["Machado de Assis"],
    year: "1953",
    countries: ["US"],
    publishers: ["Noonday Press"],
  },
  {
    title: "",
    originalTitle: "Iracema",
    authors: ["Isabel Burton"],
    originalAuthors: ["José de Alencar"],
    year: "MCMLXI",
    countries: ["GB"],
    publishers: ["Bickers & Son"],
    errors: fieldErrors({ title: "required", year: "integer" }),
  },
  {
    title: "The Hour of the Star",
    originalTitle: "A Hora da Estrela",
    authors: ["Giovanni Pontiero"],
    originalAuthors: ["Clarice Lispector"],
    year: "1986",
    countries: ["GB"],
    publishers: ["Carcanet"],
    errors: "conflict",
  },
];

const meta = {
  title: "Publications/Errors",
  component: PublicationErrors,
  args: { isOpen: true, onClose: fn() },
  beforeEach: () => seed(store, ROWS),
} satisfies Meta<typeof PublicationErrors>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Every row that was refused, and why. The valid row is absent: this is the
 * list of what has to be dealt with, not a report on the set.
 */
export const Default: Story = {
  play: async () => {
    const dialog = await screen.findByRole("dialog", {
      name: "What is wrong with these rows",
    });

    await expect(dialog).toHaveTextContent(
      "2 rows cannot be inserted until they are corrected.",
    );
    await expect(dialog).not.toHaveTextContent("Dom Casmurro");

    await expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
  },
};

/** A row refused field by field names each field and what it wanted. */
export const FieldByField: Story = {
  play: async () => {
    const dialog = await screen.findByRole("dialog", {
      name: "What is wrong with these rows",
    });
    const [first] = within(dialog).getAllByRole("listitem");

    await expect(first).toHaveTextContent("Row 2");
    await expect(first).toHaveTextContent("Title");
    await expect(first).toHaveTextContent("Year");

    // The fields read in the order the table shows them, not the order the
    // server happened to answer in.
    await expect(first).not.toHaveTextContent("Countries");
  },
};

/**
 * A row refused as a whole — one that collides with a record already stored —
 * has the row's own sentence and no list of fields, since no one field is wrong.
 */
export const RefusedAsAWhole: Story = {
  play: async () => {
    const dialog = await screen.findByRole("dialog", {
      name: "What is wrong with these rows",
    });
    const [, second] = within(dialog).getAllByRole("listitem");

    await expect(second).toHaveTextContent("The Hour of the Star");
    await expect(second).not.toHaveTextContent("Title");
  },
};

/** Each entry leads back to the row it is about, and closes on the way. */
export const GoingToTheRow: Story = {
  play: async ({ args }) => {
    const dialog = await screen.findByRole("dialog", {
      name: "What is wrong with these rows",
    });
    const [first] = within(dialog).getAllByRole("listitem");

    await userEvent.click(
      within(first).getByRole("button", { name: "Go to this row" }),
    );

    await waitFor(() =>
      expect(store.get(focusedRowIdAtom)).not.toBeUndefined(),
    );
    await expect(args.onClose).toHaveBeenCalled();
  },
};
