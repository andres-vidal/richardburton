import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { withChanges } from "modules/publication/history";
import type { PublicationHistoryEntry } from "modules/publication/model";
import { resetAll } from "modules/publication/store";
import {
  FIRST_DOM_CASMURRO,
  LOOK_ALIKE_RECORD,
  RETRANSLATED_DOM_CASMURRO,
} from "test/publication-fixtures";
import { asAdmin } from "test/session";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import PublicationDetail from "./PublicationDetail";

const DOM_CASMURRO = {
  ...LOOK_ALIKE_RECORD,
  sources: [
    "Caldwell, Helen. Introduction, 1953.",
    "Gledson, John. Deceptive Realism, 1984.",
  ],
};

// The log an admin's read brings back with the record.
const LOG: PublicationHistoryEntry[] = [
  {
    version: 2,
    undoable: true,
    action: "updated",
    actor: "curator@rb.test",
    timestamp: "2026-07-15T11:00:00",
    snapshot: { ...DOM_CASMURRO, year: 1953 },
    diff: {
      fields: { year: { from: "1952", to: "1953" } },
      sources: null,
    },
  },
  {
    version: 1,
    undoable: false,
    action: "created",
    actor: "admin@rb.test",
    timestamp: "2026-07-01T10:00:00",
    snapshot: { ...DOM_CASMURRO, year: 1952 },
    diff: null,
  },
];

const meta = {
  title: "Publications/Publication detail",
  component: PublicationDetail,
  args: { publication: DOM_CASMURRO, kind: "first_translation", follows: null },
  decorators: [
    (Story) => (
      <div className="p-8 max-w-2xl bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PublicationDetail>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * What a reader sees: the record as a sentence, and its sources. A first
 * translation has no line about its kind.
 */
export const Default: Story = {
  play: async () => {
    await expect(screen.queryByText("Retranslation")).not.toBeInTheDocument();
    await expect(screen.queryByText("Reissue")).not.toBeInTheDocument();

    // Every field a reader might want to pivot on is a search link.
    await expect(
      screen.getByRole("link", { name: "Machado de Assis" }),
    ).toHaveAttribute("href", "/en?search=Machado+de+Assis");

    // Countries render their label but search by the stored code.
    await expect(
      screen.getByRole("link", { name: "United States" }),
    ).toHaveAttribute("href", "/en?search=US");

    await expect(
      screen.getByText("Gledson, John. Deceptive Realism, 1984."),
    ).toBeInTheDocument();
  },
};

/**
 * A retranslation opens with a line that says so, above the description, and
 * links to the work's first translation. The edit form replaces the line while
 * it is open.
 */
export const Retranslation: Story = {
  args: {
    publication: RETRANSLATED_DOM_CASMURRO,
    kind: "retranslation",
    follows: FIRST_DOM_CASMURRO,
  },
  decorators: [asAdmin],
  beforeEach: () => resetAll(store),
  play: async () => {
    const line = screen.getByText(/The work was first translated by/);

    await expect(line).toHaveTextContent(
      "The work was first translated by Helen Caldwell as Dom Casmurro (1953).",
    );
    await expect(
      screen.getByRole("link", { name: "Dom Casmurro (1953)" }),
    ).toHaveAttribute("href", "/en/publications/7");
    await expect(
      line.compareDocumentPosition(screen.getByText(/is a translation of/)),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await waitFor(() =>
      expect(screen.queryByText("Retranslation")).not.toBeInTheDocument(),
    );
  },
};

/**
 * A record nobody has sourced yet says so: for a database whose worth is its
 * provenance, an absent source is worth stating.
 */
export const WithoutSources: Story = {
  args: { publication: { ...DOM_CASMURRO, sources: [] } },
  play: async () => {
    await expect(screen.getByText("Sources")).toBeVisible();
    await expect(screen.getByText(/No sources recorded yet/)).toBeVisible();
  },
};

/**
 * An admin gets the record's history and the controls to correct or remove it.
 * The gate is here rather than in each caller, so the publication offers the
 * same affordances wherever it is read.
 */
export const AsAdmin: Story = {
  args: { history: withChanges(LOG) },
  decorators: [asAdmin],
  play: async () => {
    await expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(screen.getByRole("button", { name: "Merge" })).toBeVisible();
    await expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();

    // The log came with the record: its entries are in the document while the
    // section is still collapsed.
    await expect(screen.getByText(/Year:/)).toHaveTextContent(
      "Year: 1952 → 1953",
    );
    await userEvent.click(screen.getByText("History"));
    await expect(screen.getByText("Created")).toBeVisible();
  },
};

/**
 * Editing happens in place, over the record it is about to change — there is no
 * separate screen to navigate to and come back from.
 */
export const Editing: Story = {
  decorators: [asAdmin],
  beforeEach: () => resetAll(store),
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    // The fields open on the record as it stands, not empty.
    await waitFor(() =>
      expect(screen.getByLabelText("Title")).toHaveValue("Dom Casmurro"),
    );
    await expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

    // Backing out returns the reader's view untouched.
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit" })).toBeVisible(),
    );
  },
};

/**
 * Deleting is guarded: the control opens a confirmation naming the publication,
 * and cancelling backs out without consequence. (The confirmed path needs the
 * real backend — the E2E suite covers it.)
 */
export const DeleteConfirmation: Story = {
  decorators: [asAdmin],
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    const confirmation = await screen.findByRole("dialog", {
      name: "Delete this publication?",
    });
    await expect(confirmation).toHaveTextContent(/Dom Casmurro.*1953/);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Delete this publication?" }),
      ).not.toBeInTheDocument(),
    );
  },
};

/**
 * Every value in the description is a link to a search for it, so a reader can
 * leave for everything else by the same translator, publisher or country.
 */
export const SearchLinks: Story = {
  play: async () => {
    await expect(
      screen.getByRole("link", { name: "Helen Caldwell" }),
    ).toHaveAttribute("href", "/en?search=Helen+Caldwell");
  },
};

/**
 * Duplicates are collapsed from the record that survives them: the control
 * opens the merge dialog over it, already knowing what keeps its place.
 */
export const Merging: Story = {
  decorators: [asAdmin],
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Merge" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Merge publications",
    });
    await expect(dialog).toHaveTextContent(/Dom Casmurro/);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Merge publications" }),
      ).not.toBeInTheDocument(),
    );
  },
};
