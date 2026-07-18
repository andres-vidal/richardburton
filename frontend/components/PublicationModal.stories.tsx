import type { Meta, StoryObj } from "@storybook/react";
import { Publication } from "modules/publication/model";
import { resetAll, setAll } from "modules/publication/store";
import { SessionProvider } from "modules/session";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import { PublicationModal } from "./PublicationModal";

const ADMIN = { email: "admin@rb.test", role: "admin" as const };

const DOM_CASMURRO = {
  id: 1,
  publication: {
    ...Publication.empty(),
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
  },
  errors: null,
};

// A URL-driven modal: it opens when the `?publication=<id>` query is present and
// renders that publication (read from the store) as a searchable article.
const meta = {
  title: "Publications/Publication modal",
  component: PublicationModal,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PublicationModal>;

export default meta;

type Story = StoryObj<typeof meta>;

/** No `?publication=` query — the modal stays closed. */
export const Closed: Story = {
  beforeEach: () => resetAll(),
  play: async () => {
    await expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  },
};

/** Opened by a `?publication=1` URL query, showing that publication's details. */
export const Default: Story = {
  beforeEach: () => setAll([DOM_CASMURRO]),
  parameters: {
    nextjs: { navigation: { query: { publication: "1" } } },
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
  beforeEach: () => setAll([DOM_CASMURRO]),
  decorators: [
    (Story) => (
      <SessionProvider session={ADMIN}>
        <Story />
      </SessionProvider>
    ),
  ],
  parameters: {
    nextjs: { navigation: { query: { publication: "1" } } },
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
  beforeEach: () => setAll([DOM_CASMURRO]),
  decorators: [
    (Story) => (
      <SessionProvider session={ADMIN}>
        <Story />
      </SessionProvider>
    ),
  ],
  parameters: {
    nextjs: { navigation: { query: { publication: "1" } } },
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
  beforeEach: () => setAll([{ ...DOM_CASMURRO, errors: "conflict" }]),
  decorators: [
    (Story) => (
      <SessionProvider session={ADMIN}>
        <Story />
      </SessionProvider>
    ),
  ],
  parameters: {
    nextjs: { navigation: { query: { publication: "1" } } },
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
 * A combobox dropdown opened inside the edit modal must stack *above* the modal,
 * not behind it. Regression guard for the z-index bug (the menu was `z-30`,
 * under the modal's `z-50`, so it opened but was hidden by the dialog). Uses the
 * Countries field, which autocompletes from a static list (no backend).
 */
export const EditingMenuAboveModal: Story = {
  beforeEach: () => setAll([DOM_CASMURRO]),
  decorators: [
    (Story) => (
      <SessionProvider session={ADMIN}>
        <Story />
      </SessionProvider>
    ),
  ],
  parameters: {
    nextjs: { navigation: { query: { publication: "1" } } },
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
