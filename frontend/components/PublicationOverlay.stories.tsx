import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import type { Meta, StoryObj } from "@storybook/react";
import { FC, useEffect, useState } from "react";
import { store } from "modules/store";
import { withChanges } from "modules/publication/history";
import type { PublicationHistoryEntry } from "modules/publication/model";
import { publicationFamily, setAll } from "modules/publication/store";
import { LOOK_ALIKE_RECORD } from "test/publication-fixtures";
import { asAdmin } from "test/session";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import PublicationOverlay from "./PublicationOverlay";

const PUBLICATION = {
  ...LOOK_ALIKE_RECORD,
  id: 1,
  sources: [
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
      sources: null,
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

/**
 * The overlay until the router goes back, and then a line that says it closed.
 * Closing the overlay goes back. On the database's page, going back leaves the
 * publication's address and unmounts the overlay, and this router unmounts it
 * too.
 */
const UntilClosed: FC<{ view: typeof ADMIN_VIEW }> = ({ view }) => {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    getRouter().back.mockImplementation(() => setOpen(false));
  }, []);

  return open ? <PublicationOverlay view={view} /> : <p>Closed</p>;
};

/**
 * Opens the edit form of the overlay, adds ` (abandoned)` to the title, and
 * returns the title field.
 */
async function editTheTitle() {
  await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
  const title = await screen.findByRole("textbox", { name: "Title" });
  await userEvent.type(title, " (abandoned)");
  await expect(title).toHaveValue("Dom Casmurro (abandoned)");

  return title;
}

/** Returns the confirmation that asks whether to discard an edit, once open. */
const discardConfirmation = () =>
  screen.findByRole("dialog", { name: "Discard your changes?" });

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

/** The record as a reader sees it, with its sources. */
export const Default: Story = {
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

/**
 * The edit form, opened with Edit as an admin. Clicking the Publishers label
 * does not remove the chip the field holds.
 */
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
 * sources load as rows, and "Add source" appends an empty one.
 */
export const EditingSources: Story = {
  beforeEach: () => setAll(store, [DOM_CASMURRO]),
  decorators: [asAdmin],
  parameters: {
    docs: { story: { inline: false, height: "40rem" } },
  },
  play: async () => {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    // The stored source loads as the first row.
    await waitFor(() =>
      expect(screen.getByLabelText("Source 1")).toHaveValue(
        "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
      ),
    );

    // Adding appends an empty, focusable row.
    await userEvent.click(screen.getByRole("button", { name: "Add source" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Source 2")).toHaveValue(""),
    );
    await userEvent.type(
      screen.getByLabelText("Source 2"),
      "https://archive.org/details/domcasmurro",
    );
    await expect(screen.getByLabelText("Source 2")).toHaveValue(
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
 * The menu of a combobox in the edit form stacks above the dialog. The play
 * test opens the Countries menu and compares its z-index with the dialog's.
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

/**
 * A long title does not push the copy link out of the header. The heading and
 * the link share one flex row inside a container that clips its overflow, so
 * the title gives way first: it truncates, and the link keeps its place.
 */
export const LongHeading: Story = {
  args: {
    view: Promise.resolve({
      publication: {
        ...PUBLICATION,
        title:
          "Gabriela, Clove and Cinnamon: A Novel of the Brazilian Northeast, Translated from the Portuguese with an Introduction",
        authors: ["James L. Taylor", "William L. Grossman"],
      },
    }),
  },
  parameters: {
    docs: { story: { inline: false, height: "30rem" } },
  },
  play: async () => {
    const dialog = await screen.findByRole("dialog");
    const article = dialog.querySelector("article")!;
    const heading = screen.getByRole("heading", { level: 1 });
    const link = screen.getByRole("button", { name: "Copy link" });

    await waitFor(() => {
      // The heading row lays out within its own width rather than spilling.
      expect(heading.scrollWidth).toBeLessThanOrEqual(heading.clientWidth);

      // The link stays inside the edge the article clips at. Both rectangles
      // are read in the same space, so the modal's opening transform cancels.
      const clipped =
        article.getBoundingClientRect().right -
        parseFloat(getComputedStyle(article).paddingRight);

      expect(link.getBoundingClientRect().right).toBeLessThanOrEqual(
        clipped + 1,
      );
    });
  },
};

/**
 * Closing the overlay with an unsaved edit asks first, and backing out keeps
 * the edit. The play test changes the title and presses Escape, then cancels
 * the confirmation with its Cancel button, and the second time with Escape.
 * Each time the form keeps the typed title and the overlay stays open.
 */
export const KeepingAnEdit: Story = {
  beforeEach: () => setAll(store, [DOM_CASMURRO]),
  decorators: [asAdmin],
  parameters: {
    docs: { story: { inline: false, height: "40rem" } },
  },
  play: async () => {
    const title = await editTheTitle();

    await userEvent.keyboard("{Escape}");
    const confirmation = await discardConfirmation();
    await expect(confirmation).toHaveTextContent(
      "Your changes to this publication have not been saved.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Discard your changes?" }),
      ).not.toBeInTheDocument(),
    );
    await expect(title).toHaveValue("Dom Casmurro (abandoned)");

    await userEvent.keyboard("{Escape}");
    await discardConfirmation();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Discard your changes?" }),
      ).not.toBeInTheDocument(),
    );
    await expect(title).toHaveValue("Dom Casmurro (abandoned)");
    await expect(getRouter().back).not.toHaveBeenCalled();
  },
};

/**
 * Discard closes the overlay, and the edit goes with it. The play test changes
 * the title, presses Escape and confirms the discard, and checks that the
 * overlay closed and that the row is back to its saved title.
 */
export const DiscardingAnEdit: Story = {
  beforeEach: () => setAll(store, [DOM_CASMURRO]),
  decorators: [asAdmin],
  render: () => <UntilClosed view={ADMIN_VIEW} />,
  parameters: {
    docs: { story: { inline: false, height: "40rem" } },
  },
  play: async () => {
    await editTheTitle();

    await userEvent.keyboard("{Escape}");
    await discardConfirmation();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    await expect(await screen.findByText("Closed")).toBeVisible();
    await expect(getRouter().back).toHaveBeenCalledTimes(1);
    await expect(store.get(publicationFamily(1))?.title).toBe("Dom Casmurro");
  },
};

/**
 * With nothing changed, closing the edit form's overlay asks nothing. The play
 * test opens the form and presses Escape, and checks that the overlay closed
 * without a confirmation.
 */
export const ClosingWithoutChanges: Story = {
  beforeEach: () => setAll(store, [DOM_CASMURRO]),
  decorators: [asAdmin],
  render: () => <UntilClosed view={ADMIN_VIEW} />,
  parameters: {
    docs: { story: { inline: false, height: "40rem" } },
  },
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await screen.findByRole("button", { name: "Save" });

    await userEvent.keyboard("{Escape}");

    await expect(await screen.findByText("Closed")).toBeVisible();
    await expect(getRouter().back).toHaveBeenCalledTimes(1);
    await expect(
      screen.queryByRole("dialog", { name: "Discard your changes?" }),
    ).not.toBeInTheDocument();
  },
};
