import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { empty } from "modules/publication/model";
import {
  createId,
  resetAll,
  setAll,
  setResemblances,
} from "modules/publication/store";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import PublicationResemblances from "./PublicationResemblances";

const STORED = {
  ...empty(),
  id: 7,
  title: "Dom Casmurro",
  authors: ["Helen Caldwell"],
  originalTitle: "Dom Casmurro",
  originalAuthors: ["Machado de Assis"],
  year: "1953",
  countries: ["US"],
  publishers: ["Noonday Press"],
};

const ROWS = [
  {
    id: createId(),
    errors: null,
    publication: { ...STORED, id: null, title: "Dom Casmuro" },
  },
  {
    id: createId(),
    errors: null,
    publication: {
      ...empty(),
      title: "The Devil to Pay in the Backlands",
      authors: ["James L. Taylor"],
      originalTitle: "Grande Sertão: Veredas",
      originalAuthors: ["João Guimarães Rosa"],
      year: "1963",
      countries: ["US"],
      publishers: ["Knopf"],
    },
  },
  {
    id: createId(),
    errors: null,
    publication: {
      ...empty(),
      title: "The Devil to Pay in the Backland",
      authors: ["James L Taylor"],
      originalTitle: "Grande Sertao Veredas",
      originalAuthors: ["João Guimarães Rosa"],
      year: "1963",
      countries: ["GB"],
      publishers: ["Knopf"],
    },
  },
];

const ids = ROWS.map(({ id }) => id);

const meta = {
  title: "Publications/Resemblance review",
  component: PublicationResemblances,
  args: { isOpen: true, onClose: () => {} },
  parameters: {
    layout: "fullscreen",
    // Full-screen portalled modal — bound it in the docs page.
    docs: { story: { inline: false, height: "34rem" } },
  },
  beforeEach: () => {
    resetAll(store);
    setAll(store, ROWS);
    setResemblances(
      store,
      ids,
      new Map([
        [ids[0], { stored: [STORED], others: [] }],
        [ids[1], { stored: [], others: [ids[2]] }],
        [ids[2], { stored: [], others: [ids[1]] }],
      ]),
    );
  },
} satisfies Meta<typeof PublicationResemblances>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The first question: a row that all but spells a record already in the
 * database, with both side by side.
 */
export const AgainstTheDatabase: Story = {
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    await expect(
      screen.getByText("Resembles one record already in the database."),
    ).toBeVisible();

    // The row being imported and the record it resembles are both on the page.
    await expect(screen.getByText("The row being imported")).toBeVisible();
    await expect(screen.getByText("Already in the database")).toBeVisible();
    await expect(screen.getByText("1 / 3")).toBeVisible();
  },
};

/**
 * A question about two rows of the same import. Neither is in the database, so
 * the review is the only place this pair is ever put together.
 */
export const WithinTheImport: Story = {
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Answer the first question to reach the second.
    await userEvent.click(
      screen.getByRole("button", { name: "Keep it — they are different" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Resembles one other row of this import."),
      ).toBeVisible(),
    );
    await expect(screen.getByText("Elsewhere in this import")).toBeVisible();
    await expect(screen.getByText("2 / 3")).toBeVisible();
  },
};

/**
 * Answering every question ends the review. The progress is counted against
 * the queue as it stood when the dialog opened, so answering does not renumber
 * what is left.
 */
export const AllAnswered: Story = {
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    await userEvent.click(
      screen.getByRole("button", { name: "Keep it — they are different" }),
    );
    await expect(await screen.findByText("2 / 3")).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: "Discard this row" }),
    );
    await expect(await screen.findByText("3 / 3")).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: "Keep it — they are different" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Every look-alike answered")).toBeVisible(),
    );
  },
};
