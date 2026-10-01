import type { Meta, StoryObj } from "@storybook/react";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
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

const page = (entries: DocumentSummary[], more = false): DocumentPage => ({
  entries,
  more,
});

/** A document older than the first page's, returned as the next page. */
const OLDER: DocumentSummary = {
  id: 7,
  name: "Machado, first sweep",
  rows: 64,
  archivedAt: null,
  insertedAt: "2026-05-02T10:00:00",
  updatedAt: "2026-05-03T10:00:00",
};

const meta = {
  title: "Publications/Import documents",
  component: DocumentList,
  args: {
    side: "current",
    first: page(KEPT),
    readMore: fn(async () => page([OLDER])),
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
 * The current documents, each with its row count. The client counts the rows,
 * because the server stores a document as Yjs updates that it does not parse.
 */
export const Default: Story = {
  play: async () => {
    await expect(
      screen.getByRole("link", { name: /Second pass, 2026/ }),
    ).toHaveTextContent("428 rows");

    // The count uses the singular for one row.
    await expect(
      screen.getByRole("link", { name: /Amado retranslations/ }),
    ).toHaveTextContent("1 row");
  },
};

/** With no documents, a message says so instead of an empty list. */
export const Empty: Story = {
  args: { first: page([]) },
  play: async () => {
    await expect(screen.getByText(/No documents yet/)).toBeVisible();
  },
};

/**
 * **Start a document** is disabled until a name is typed. The name is how
 * people tell documents apart in the list.
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
 * **Rename** turns the name into a text field in the same row, and Enter saves
 * the new name.
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

/** Escape cancels a rename and keeps the old name. */
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

/** **Archive** moves a document off the current list without deleting it. */
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

/** Choosing **Archived** navigates to the archived side's own URL. */
export const LookingAtTheOtherSide: Story = {
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Archived" }));

    await expect(getRouter().push).toHaveBeenCalledWith(
      expect.stringContaining("/admin/publications/documents?archived=true"),
    );
  },
};

/** On the archived side, **Put it back** restores a document. */
export const PuttingOneBack: Story = {
  args: { side: "archived", first: page(RETIRED) },
  play: async ({ args }) => {
    await expect(
      screen.getByRole("button", { name: "Archived" }),
    ).toHaveAttribute("aria-pressed", "true");

    const list = await screen.findByRole("list", { name: "Archived" });
    const [first] = within(list).getAllByRole("listitem");

    await expect(first).toHaveTextContent("Abandoned sweep");
    // An archived document has no Rename or Archive button.
    await expect(
      within(first).queryByRole("button", { name: "Archive" }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(first).getByRole("button", { name: "Put it back" }),
    );

    await waitFor(() => expect(args.restore).toHaveBeenCalledWith(9));
  },
};

/** With no archived documents, a message says so instead of an empty list. */
export const NothingArchived: Story = {
  args: { side: "archived", first: page([]) },
  play: async () => {
    await expect(screen.getByText(/Nothing has been archived/)).toBeVisible();
  },
};

/**
 * The list shows one page at a time and offers **Show more** when there are
 * more. The next page is read starting after the last document shown, so a
 * document that changes in between is not shown twice.
 */
export const MoreToShow: Story = {
  args: { first: page(KEPT, true) },
  play: async ({ args }) => {
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /Machado, first sweep/ }),
      ).toBeVisible(),
    );
    await expect(args.readMore).toHaveBeenCalledWith(
      expect.objectContaining({ after: KEPT[1], archived: false }),
    );

    // The second page was the last one, so the button is gone.
    await expect(
      screen.queryByRole("button", { name: "Show more" }),
    ).not.toBeInTheDocument();
  },
};
