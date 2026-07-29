import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { FC, useState } from "react";
import { store } from "modules/store";
import { withChanges } from "modules/publication/history";
import {
  Publication,
  type PublicationHistoryEntry,
} from "modules/publication/model";
import { setAll } from "modules/publication/store";
import { SessionProvider } from "modules/session";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import PublicationOverlay from "./PublicationOverlay";

const ADMIN = { email: "admin@rb.test", role: "admin" as const };

const asAdmin: Decorator = (Story) => (
  <SessionProvider session={ADMIN}>
    <Story />
  </SessionProvider>
);

const PUBLICATION = {
  ...Publication.empty(),
  id: 1,
  title: "Dom Casmurro",
  authors: "Helen Caldwell",
  originalTitle: "Dom Casmurro",
  originalAuthors: "Machado de Assis",
  year: "1953",
  countries: "US",
  publishers: "Noonday Press",
  references: [
    "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
  ],
};

const DOM_CASMURRO = { id: 1, publication: PUBLICATION, errors: null };

const LOG: PublicationHistoryEntry[] = [
  {
    version: 2,
    undoable: true,
    action: "updated",
    actor: "curator@rb.test",
    timestamp: "2026-07-15T11:00:00",
    snapshot: { ...PUBLICATION, year: 1953 },
    diff: {
      fields: { title: { from: "Dom Casmurro (draft)", to: "Dom Casmurro" } },
      references: null,
    },
  },
  {
    version: 1,
    undoable: false,
    action: "created",
    actor: "admin@rb.test",
    timestamp: "2026-07-01T10:00:00",
    snapshot: { ...PUBLICATION, title: "Dom Casmurro (draft)", year: 1953 },
    diff: null,
  },
];

// The record the URL names, read on the server and handed over unawaited. A
// story stands in for that read with a promise of its own.
const READER_VIEW = Promise.resolve({ publication: PUBLICATION });
const ADMIN_VIEW = Promise.resolve({
  publication: PUBLICATION,
  history: withChanges(LOG),
});

/**
 * The overlay with a read slow enough to see it open before the record lands.
 * The promise is made on mount, so each run of the story sees one in flight.
 */
const StreamingOverlay: FC = () => {
  const [view] = useState(
    () =>
      new Promise<{ publication: typeof PUBLICATION }>((resolve) =>
        setTimeout(() => resolve({ publication: PUBLICATION }), 600),
      ),
  );

  return <PublicationOverlay view={view} />;
};

const meta = {
  title: "Publications/Publication overlay",
  component: PublicationOverlay,
  args: { view: READER_VIEW },
  // The overlay shows a publication only while the address is one; the mocked
  // router would otherwise put these stories on the index.
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/publications/1" } },
  },
} satisfies Meta<typeof PublicationOverlay>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The record is read for the address the overlay is at, so it can arrive after
 * the overlay is on screen. The overlay opens on the click and holds the
 * record's place until it lands, at roughly the size it will take.
 */
export const Streaming: Story = {
  render: () => <StreamingOverlay />,
  parameters: {
    docs: { story: { inline: false, height: "30rem" } },
  },
  play: async ({ canvasElement }) => {
    const dialog = await waitFor(() =>
      canvasElement.ownerDocument.querySelector("dialog"),
    );
    const height = () => Math.round(dialog!.getBoundingClientRect().height);

    // The placeholder is there first, at the size the record will be.
    await expect(screen.getByRole("status", { name: "Loading" })).toBeVisible();
    const placeholder = height();

    await waitFor(() =>
      expect(screen.getByText(/is a translation of/)).toBeVisible(),
    );

    // The record takes its place without moving the dialog.
    await expect(Math.abs(height() - placeholder)).toBeLessThan(64);
  },
};

/**
 * An admin also gets the record's mutation log — and gets it *with* the record:
 * the entries are already in the document while the section is still collapsed,
 * so opening it fetches nothing.
 */
export const WithHistory: Story = {
  args: { view: ADMIN_VIEW },
  decorators: [asAdmin],
  parameters: {
    docs: { story: { inline: false, height: "30rem" } },
  },
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await expect(screen.getByText(/Title:/)).toHaveTextContent(
      "Title: Dom Casmurro (draft) → Dom Casmurro",
    );
    await expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  },
};

/**
 * A link to a record that has since been deleted says so, rather than opening
 * an empty overlay.
 */
export const Missing: Story = {
  args: { view: Promise.resolve(null) },
  parameters: {
    docs: { story: { inline: false, height: "20rem" } },
  },
  play: async () => {
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "This publication is not here" }),
      ).toBeInTheDocument(),
    );
  },
};

/** Opened by a `?publication=1` URL query, showing that publication's details. */
export const Default: Story = {
  beforeEach: () => setAll(store, [DOM_CASMURRO]),
  parameters: {
    // Full-screen portalled modal — bound it in the docs page.
    docs: { story: { inline: false, height: "30rem" } },
  },
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    // "Helen Caldwell" appears in both the heading and a searchable link.
    await expect(screen.getAllByText(/Helen Caldwell/).length).toBeGreaterThan(
      0,
    );
    // Provenance is listed for the reader to verify against.
    await expect(
      screen.getByText(/Introduction to Dom Casmurro/),
    ).toBeInTheDocument();
  },
};

export const Editing: Story = {
  beforeEach: () => setAll(store, [DOM_CASMURRO]),
  decorators: [asAdmin],
  parameters: {
    docs: { story: { inline: false, height: "30rem" } },
  },
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument(),
    );

    // The Publishers field holds one chip. Clicking the field's label must not
    // remove it.
    await expect(screen.getByText("Noonday Press")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Publishers"));
    await expect(screen.getByText("Noonday Press")).toBeInTheDocument();
  },
};

/**
 * The edit form carries a provenance editor: the publication's existing
 * references load as rows, and "Add reference" appends an empty one.
 */
export const EditingReferences: Story = {
  beforeEach: () => setAll(store, [DOM_CASMURRO]),
  decorators: [asAdmin],
  parameters: {
    docs: { story: { inline: false, height: "40rem" } },
  },
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    // The stored reference loads as the first row.
    await waitFor(() =>
      expect(screen.getByLabelText("Reference 1")).toHaveValue(
        "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
      ),
    );

    // Adding appends an empty, focusable row.
    await userEvent.click(
      screen.getByRole("button", { name: "Add reference" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Reference 2")).toHaveValue(""),
    );
    await userEvent.type(
      screen.getByLabelText("Reference 2"),
      "https://archive.org/details/domcasmurro",
    );
    await expect(screen.getByLabelText("Reference 2")).toHaveValue(
      "https://archive.org/details/domcasmurro",
    );
  },
};

/**
 * Save is disabled while the row has validation errors — there is nothing to gain
 * from a round-trip the server will reject.
 */
export const EditingWithErrors: Story = {
  beforeEach: () => setAll(store, [{ ...DOM_CASMURRO, errors: "conflict" }]),
  decorators: [asAdmin],
  parameters: {
    docs: { story: { inline: false, height: "30rem" } },
  },
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled(),
    );
    // Cancel stays available — you must be able to back out of a broken row.
    await expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  },
};

/**
 * The server-side delete is guarded: the Delete button opens a confirmation
 * naming the publication, and cancelling backs out without consequence. (The
 * confirmed path needs the real backend — the E2E suite covers it.)
 */
export const DeleteConfirmation: Story = {
  beforeEach: () => setAll(store, [DOM_CASMURRO]),
  decorators: [asAdmin],
  parameters: {
    docs: { story: { inline: false, height: "30rem" } },
  },
  play: async () => {
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: "Publication details" }),
      ).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    // The confirmation names the record it is about to remove.
    const confirmation = await screen.findByRole("dialog", {
      name: "Delete this publication?",
    });
    await expect(confirmation).toHaveTextContent(/Dom Casmurro.*1953/);

    // Backing out leaves the publication modal (and the record) untouched.
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Delete this publication?" }),
      ).not.toBeInTheDocument(),
    );
    await expect(
      screen.getByRole("dialog", { name: "Publication details" }),
    ).toBeInTheDocument();
  },
};

/**
 * A combobox dropdown opened inside the edit modal must stack *above* the modal,
 * not behind it. Regression guard for the z-index bug (the menu was `z-30`,
 * under the modal's `z-50`, so it opened but was hidden by the dialog). Uses the
 * Countries field, which autocompletes from a static list (no backend).
 */
export const EditingMenuAboveModal: Story = {
  beforeEach: () => setAll(store, [DOM_CASMURRO]),
  decorators: [asAdmin],
  parameters: {
    docs: { story: { inline: false, height: "30rem" } },
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument(),
    );

    // Capture the modal overlay's z-index now: once the dropdown opens, its own
    // focus manager aria-hides the dialog, so it's no longer queryable by role.
    const overlay = screen.getByRole("dialog").closest(".z-50")!;
    const modalZ = Number(getComputedStyle(overlay).zIndex);

    await userEvent.type(
      screen.getByRole("combobox", { name: "Countries" }),
      "United",
    );
    const listbox = await screen.findByRole("listbox");

    // The dropdown's z-index must beat the modal overlay's — both are body-level
    // floating portals, so their stacking is decided by z-index.
    await expect(Number(getComputedStyle(listbox).zIndex)).toBeGreaterThan(
      modalZ,
    );
  },
};
