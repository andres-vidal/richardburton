import type { Meta, StoryObj } from "@storybook/react";
import type { DocumentSummary } from "modules/publication/document-remote";
import { expect, screen, userEvent, waitFor } from "storybook/test";

import DocumentList from "./DocumentList";

const KEPT: DocumentSummary[] = [
  {
    id: 1,
    name: "Second pass, 2026",
    rows: 428,
    insertedAt: "2026-09-01T10:00:00",
    updatedAt: "2026-09-19T16:20:00",
  },
  {
    id: 2,
    name: "Amado retranslations",
    rows: 1,
    insertedAt: "2026-08-14T09:00:00",
    updatedAt: "2026-08-14T09:30:00",
  },
];

const meta = {
  title: "Publications/Import documents",
  component: DocumentList,
  args: {
    read: async () => KEPT,
    start: async (name: string) => ({
      id: 3,
      name,
      rows: 0,
      insertedAt: "2026-09-20T12:00:00",
      updatedAt: "2026-09-20T12:00:00",
    }),
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
  args: { read: async () => [] },
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
