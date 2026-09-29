import type { Meta, StoryObj } from "@storybook/react";
import type { LiveState } from "modules/publication/document-live";
import type { SyncState } from "modules/publication/document-sync";
import { aDocumentWith } from "modules/publication/fixtures";
import { LiveProvider } from "modules/publication/presence";
import { expect, screen, userEvent } from "storybook/test";

import DocumentStatus from "./DocumentStatus";

type Args = { connection?: LiveState; saving?: SyncState };

// An empty document for `LiveProvider`. These stories only set the connection
// and save state, so nobody else is in it.
const document = aDocumentWith();

const meta = {
  title: "Publications/Document status",
  component: DocumentStatus,
  render: ({ connection, saving }: Args) =>
    connection && saving ? (
      <LiveProvider
        awareness={document.awareness}
        presence={document.presence}
        connection={connection}
        saving={saving}
      >
        <DocumentStatus />
      </LiveProvider>
    ) : (
      <DocumentStatus />
    ),
  parameters: { layout: "centered" },
} satisfies Meta<Args>;

export default meta;

type Story = StoryObj<Args>;

/** Everything typed here has reached the server, and the connection is live. */
export const Saved: Story = {
  args: { connection: "live", saving: "saved" },
  play: async () => {
    await expect(screen.getByRole("status")).toHaveTextContent("Saved");
  },
};

/** Some changes made here have not reached the server yet. */
export const Saving: Story = {
  args: { connection: "live", saving: "saving" },
  play: async () => {
    await expect(screen.getByRole("status")).toHaveTextContent("Saving");
  },
};

/**
 * Changes made here are on this computer but have not reached the server. The
 * tooltip explains this on hover.
 */
export const NotSaved: Story = {
  args: { connection: "offline", saving: "offline" },
  play: async () => {
    const status = screen.getByRole("status");

    await expect(status).toHaveTextContent("Not saved");

    // "Not saved" is shown instead of "Not live", because only a failed save
    // can lose work.
    await expect(status).not.toHaveTextContent("Not live");

    await userEvent.hover(status);
    await expect(
      await screen.findByText(/has not reached the server/),
    ).toBeVisible();
  },
};

/**
 * Changes are saving, but other people's changes are not arriving. Without this
 * state, a document that is not live would look the same as one nobody else is
 * editing.
 */
export const NotLive: Story = {
  args: { connection: "offline", saving: "saved" },
  play: async () => {
    await expect(screen.getByRole("status")).toHaveTextContent("Not live");
  },
};

/** The connection is being opened again. Changes made meanwhile are kept. */
export const Reconnecting: Story = {
  args: { connection: "connecting", saving: "saved" },
  play: async () => {
    await expect(screen.getByRole("status")).toHaveTextContent("Reconnecting");
  },
};

/**
 * Outside a `LiveProvider`, such as in the edit form for a saved publication,
 * the component renders nothing.
 */
export const NotADocument: Story = {
  args: {},
  play: async () => {
    await expect(screen.queryByRole("status")).not.toBeInTheDocument();
  },
};
