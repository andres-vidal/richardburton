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

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

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
 * The reading goes both ways and stops at the ends, so a reader can go back to
 * something they have already passed.
 */
export const ReadingBothWays: Story = {
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Nothing before the first.
    await expect(
      screen.getByRole("button", { name: "Previous" }),
    ).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await expect(await screen.findByText("3 / 3")).toBeVisible();

    // ...and nothing after the last.
    await expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    await expect(await screen.findByText("2 / 3")).toBeVisible();
  },
};
