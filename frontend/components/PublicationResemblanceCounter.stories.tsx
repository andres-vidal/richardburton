import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { empty } from "modules/publication/model";
import {
  addNew,
  createId,
  resetAll,
  setAll,
  setResemblances,
} from "modules/publication/store";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import PublicationResemblanceCounter from "./PublicationResemblanceCounter";

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

// Three rows on their way in: one that all but spells the stored record, and
// two that spell each other.
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

/** What the server would answer for those rows, without a server. */
const found = async () =>
  setResemblances(
    store,
    ids,
    new Map([
      [ids[0], { stored: [STORED], others: [] }],
      [ids[1], { stored: [], others: [ids[2]] }],
      [ids[2], { stored: [], others: [ids[1]] }],
    ]),
  );

const nothing = async () => setResemblances(store, ids, new Map());

const meta = {
  title: "Publications/Resemblance counter",
  component: PublicationResemblanceCounter,
  args: { check: found },
  beforeEach: () => {
    resetAll(store);
    setAll(store, ROWS);
  },
  decorators: [
    (Story) => (
      <div className="flex p-8 bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PublicationResemblanceCounter>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Before the check has been run there is nothing to report, so the button
 * offers to run it rather than showing a count of zero.
 */
export const Unchecked: Story = {
  play: async () => {
    await expect(
      screen.getByRole("button", { name: "Check for duplicates" }),
    ).toBeVisible();
  },
};

/** The check found look-alikes, and the count is the way into them. */
export const Found: Story = {
  play: async () => {
    await userEvent.click(
      screen.getByRole("button", { name: "Check for duplicates" }),
    );

    // All three rows are raised: one against the database, two against each
    // other.
    const button = await screen.findByRole("button", {
      name: "3 rows look like publications already known",
    });
    await expect(button).toHaveTextContent("3");

    await userEvent.click(button);
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", {
          name: "Possible duplicates in this import",
        }),
      ).toBeInTheDocument(),
    );
  },
};

/**
 * A set with nothing alike in it says so with a check, not a zero — the same
 * way the error counter reports a set with no errors.
 */
export const NoneFound: Story = {
  args: { check: nothing },
  play: async () => {
    await userEvent.click(
      screen.getByRole("button", { name: "Check for duplicates" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("status", {
          name: "No row looks like anything already known",
        }),
      ).toBeVisible(),
    );
  },
};

/**
 * A row added after the check unsays the answer: it has never been measured, so
 * the count would be speaking for a working set it does not cover.
 */
export const StaleAfterAnAddition: Story = {
  play: async () => {
    await userEvent.click(
      screen.getByRole("button", { name: "Check for duplicates" }),
    );
    await expect(
      await screen.findByRole("button", {
        name: "3 rows look like publications already known",
      }),
    ).toBeVisible();

    addNew(store);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Check for duplicates" }),
      ).toBeVisible(),
    );
  },
};
