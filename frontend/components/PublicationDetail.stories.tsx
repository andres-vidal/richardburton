import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { withChanges } from "modules/publication/history";
import { empty, type PublicationHistoryEntry } from "modules/publication/model";
import { resetAll } from "modules/publication/store";
import { SessionProvider } from "modules/session";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";

import PublicationDetail from "./PublicationDetail";

const ADMIN = { email: "admin@rb.test", role: "admin" as const };

/** Admin affordances are role-gated inside the view, so a story asks for them
 * by signing in rather than by passing a prop. */
const asAdmin: Decorator = (Story) => (
  <SessionProvider session={ADMIN}>
    <Story />
  </SessionProvider>
);

const DOM_CASMURRO = {
  ...empty(),
  id: 7,
  title: "Dom Casmurro",
  authors: "Helen Caldwell",
  originalTitle: "Dom Casmurro",
  originalAuthors: "Machado de Assis",
  year: "1953",
  countries: "US",
  publishers: "Noonday Press",
  references: [
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
      references: null,
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
  args: { publication: DOM_CASMURRO },
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

/** What a reader sees: the record as a sentence, and its sources. */
export const Default: Story = {
  play: async () => {
    // Every field a reader might want to pivot on is a search link.
    await expect(
      screen.getByRole("link", { name: "Machado de Assis" }),
    ).toHaveAttribute("href", "/?search=Machado de Assis");

    // Countries render their label but search by the stored code.
    await expect(
      screen.getByRole("link", { name: "United States of America" }),
    ).toHaveAttribute("href", "/?search=US");

    await expect(
      screen.getByText("Gledson, John. Deceptive Realism, 1984."),
    ).toBeInTheDocument();
  },
};

/** A record nobody has sourced yet simply omits the section. */
export const WithoutReferences: Story = {
  args: { publication: { ...DOM_CASMURRO, references: [] } },
  play: async () => {
    await expect(screen.queryByText("References")).not.toBeInTheDocument();
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
    await expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();

    // The log came with the record: its entries are in the document while the
    // section is still collapsed, so expanding it fetches nothing.
    await expect(screen.getByText(/Year:/)).toHaveTextContent(
      "Year: 1952 → 1953",
    );
    await userEvent.click(screen.getByText("History"));
    await expect(screen.getByText("created")).toBeVisible();
  },
};

/**
 * Editing happens in place, over the record it is about to change — there is no
 * separate screen to navigate to and come back from.
 */
export const Editing: Story = {
  decorators: [asAdmin],
  beforeEach: () => resetAll(),
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
 * Following a search link tells the caller — an overlay uses it to close
 * itself, a page ignores it.
 */
export const NotifiesOnNavigate: Story = {
  args: { onNavigate: fn() },
  play: async ({ args }) => {
    await userEvent.click(screen.getByRole("link", { name: "Helen Caldwell" }));
    await expect(args.onNavigate).toHaveBeenCalled();
  },
};
