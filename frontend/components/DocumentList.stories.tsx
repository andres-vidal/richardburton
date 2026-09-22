import type { Meta, StoryObj } from "@storybook/react";
import type {
  DocumentPage,
  DocumentSummary,
} from "modules/publication/document-remote";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import DocumentList from "./DocumentList";

const KEPT: DocumentSummary[] = [
  {
    id: 1,
    name: "Second pass, 2026",
    rows: 428,
    archivedAt: null,
    insertedAt: "2026-09-01T10:00:00",
    updatedAt: "2026-09-19T16:20:00",
  },
  {
    id: 2,
    name: "Amado retranslations",
    rows: 1,
    archivedAt: null,
    insertedAt: "2026-08-14T09:00:00",
    updatedAt: "2026-08-14T09:30:00",
  },
];

const RETIRED: DocumentSummary[] = [
  {
    id: 9,
    name: "Abandoned sweep",
    rows: 12,
    archivedAt: "2026-09-10T11:00:00",
    insertedAt: "2026-07-01T10:00:00",
    updatedAt: "2026-07-02T10:00:00",
  },
];

const page = (entries: DocumentSummary[], total = entries.length) => ({
  entries,
  total,
});

/** Both sides of the list, so the archived one can be looked at. */
const read = async ({
  archived,
}: {
  limit: number;
  offset: number;
  archived: boolean;
}): Promise<DocumentPage> => page(archived ? RETIRED : KEPT);

const meta = {
  title: "Publications/Import documents",
  component: DocumentList,
  args: {
    read,
    start: async (name: string) => ({
      id: 3,
      name,
      rows: 0,
      archivedAt: null,
      insertedAt: "2026-09-20T12:00:00",
      updatedAt: "2026-09-20T12:00:00",
    }),
    rename: fn(async (id: number, name: string) => ({ ...KEPT[0], id, name })),
    archive: fn(async (id: number) => ({
      ...KEPT[0],
      id,
      archivedAt: "2026-09-22T10:00:00",
    })),
    restore: fn(async (id: number) => ({
      ...RETIRED[0],
      id,
      archivedAt: null,
    })),
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DocumentList>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The documents a person may open. Each says what it holds, and the count is
 * the client's word — the server keeps the document as bytes it does not read,
 * so it cannot count rows in one.
 */
export const Default: Story = {
  play: async () => {
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /Second pass, 2026/ }),
      ).toBeVisible(),
    );

    await expect(
      screen.getByRole("link", { name: /Second pass, 2026/ }),
    ).toHaveTextContent("428 rows");

    // One row is one row, not "1 rows".
    await expect(
      screen.getByRole("link", { name: /Amado retranslations/ }),
    ).toHaveTextContent("1 row");
  },
};

/** Nothing kept yet says so, rather than showing an empty list. */
export const Empty: Story = {
  args: { read: async () => page([]) },
  play: async () => {
    await waitFor(() =>
      expect(screen.getByText(/No documents yet/)).toBeVisible(),
    );
  },
};

/**
 * A document needs a name before it can be started — it is what the list will
 * call it, and an unnamed one could not be told from another.
 */
export const NeedsAName: Story = {
  play: async () => {
    const start = screen.getByRole("button", { name: "Start a document" });
    await expect(start).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Name"), "Second pass");
    await waitFor(() => expect(start).toBeEnabled());
  },
};

/**
 * Renaming happens in place. A batch called "Second pass" that turns out to be
 * the 1970s is a correction, and a correction should not need a dialog.
 */
export const RenamingInPlace: Story = {
  play: async ({ args }) => {
    const list = await screen.findByRole("list", { name: "Import documents" });
    const [first] = within(list).getAllByRole("listitem");

    await userEvent.click(
      within(first).getByRole("button", { name: "Rename" }),
    );

    const field = within(first).getByLabelText("Name of Second pass, 2026");
    await userEvent.clear(field);
    await userEvent.type(field, "The 1970s{Enter}");

    await waitFor(() =>
      expect(args.rename).toHaveBeenCalledWith(1, "The 1970s"),
    );
  },
};

/** Escape leaves the name as it was, so a rename can be thought better of. */
export const RenamingCalledOff: Story = {
  play: async ({ args }) => {
    const list = await screen.findByRole("list", { name: "Import documents" });
    const [first] = within(list).getAllByRole("listitem");

    await userEvent.click(
      within(first).getByRole("button", { name: "Rename" }),
    );

    const field = within(first).getByLabelText("Name of Second pass, 2026");
    await userEvent.clear(field);
    await userEvent.type(field, "Something else{Escape}");

    await expect(args.rename).not.toHaveBeenCalled();
    await expect(
      within(first).getByRole("link", { name: /Second pass, 2026/ }),
    ).toBeVisible();
  },
};

/**
 * Archiving takes a document off the list without destroying it. What it holds
 * is a record of what was prepared, and somebody spent an afternoon on it.
 */
export const Archiving: Story = {
  play: async ({ args }) => {
    const list = await screen.findByRole("list", { name: "Import documents" });
    const [first] = within(list).getAllByRole("listitem");

    await userEvent.click(
      within(first).getByRole("button", { name: "Archive" }),
    );

    await waitFor(() => expect(args.archive).toHaveBeenCalledWith(1));
  },
};

/** What was archived is readable, and anything on it can be put back. */
export const PuttingOneBack: Story = {
  play: async ({ args }) => {
    await userEvent.click(screen.getByRole("button", { name: "Archived" }));

    const list = await screen.findByRole("list", { name: "Archived" });
    const [first] = within(list).getAllByRole("listitem");

    await expect(first).toHaveTextContent("Abandoned sweep");
    // Nothing to rename or archive on this side: it is already off the list.
    await expect(
      within(first).queryByRole("button", { name: "Archive" }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(first).getByRole("button", { name: "Put it back" }),
    );

    await waitFor(() => expect(args.restore).toHaveBeenCalledWith(9));
  },
};

/** Nothing archived says so rather than showing an empty list. */
export const NothingArchived: Story = {
  args: { read: async () => page([]) },
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Archived" }));

    await waitFor(() =>
      expect(screen.getByText(/Nothing has been archived/)).toBeVisible(),
    );
  },
};

/**
 * A workspace kept for years holds more documents than anyone reads at once, so
 * the list is a page of them and says when there are more.
 */
export const MoreToShow: Story = {
  args: { read: async () => page(KEPT, 40) },
  play: async () => {
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Show more" })).toBeVisible(),
    );
  },
};
