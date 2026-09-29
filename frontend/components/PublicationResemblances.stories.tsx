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
    // The modal is full screen and rendered in a portal, so the docs page shows
    // it in an iframe of fixed height.
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
 * The first row in the queue is a near-copy of a stored record. The review
 * shows the row and the record.
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
 * The second row in the queue resembles another row of the same import. Neither
 * row is stored, so the duplicate review cannot show this pair.
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
 * Next and Previous move through the queue in both directions. Previous is
 * disabled on the first row, and Next is disabled on the last.
 */
export const ReadingBothWays: Story = {
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Previous is disabled on the first row.
    await expect(
      screen.getByRole("button", { name: "Previous" }),
    ).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await expect(await screen.findByText("3 / 3")).toBeVisible();

    // Next is disabled on the last row.
    await expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    await expect(await screen.findByText("2 / 3")).toBeVisible();
  },
};
