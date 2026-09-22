import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { empty } from "modules/publication/model";
import {
  createId,
  resetAll,
  setAll,
  setDiscarded,
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

/** What the server would have answered for those rows, without a server. */
const found = () =>
  setResemblances(
    store,
    ids,
    new Map([
      [ids[0], { stored: [STORED], others: [] }],
      [ids[1], { stored: [], others: [ids[2]] }],
      [ids[2], { stored: [], others: [ids[1]] }],
    ]),
  );

const meta = {
  title: "Publications/Resemblance counter",
  component: PublicationResemblanceCounter,
  beforeEach: () => {
    resetAll(store);
    setAll(store, ROWS);
    found();
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
 * The count, which is the way into the questions. All three rows are raised:
 * one against the database, two against each other.
 */
export const Found: Story = {
  play: async () => {
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
 * Nothing alike is nothing to say. There is no control at all rather than one
 * reading zero: a look-alike is a question, and no question is not news.
 */
export const NothingAlike: Story = {
  beforeEach: () => {
    resetAll(store);
    setAll(store, ROWS);
    setResemblances(store, ids, new Map());
  },
  play: async () => {
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  },
};

/**
 * The count is a fact about the rows, not a queue to burn down: it falls when a
 * row stops looking like something, which happens by correcting or discarding
 * the row itself.
 */
export const DiscardingLowersIt: Story = {
  play: async () => {
    await expect(
      await screen.findByRole("button", {
        name: "3 rows look like publications already known",
      }),
    ).toBeVisible();

    setDiscarded(store, [ids[0]]);

    await expect(
      await screen.findByRole("button", {
        name: "2 rows look like publications already known",
      }),
    ).toBeVisible();
  },
};
