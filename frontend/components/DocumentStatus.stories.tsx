import type { Meta, StoryObj } from "@storybook/react";
import type { LiveState } from "modules/publication/document-live";
import type { SyncState } from "modules/publication/document-sync";
import { LiveProvider } from "modules/publication/presence";
import { expect, screen, userEvent } from "storybook/test";

import DocumentStatus from "./DocumentStatus";

type Args = { connection?: LiveState; saving?: SyncState };

const meta = {
  title: "Publications/Document status",
  component: DocumentStatus,
  render: ({ connection, saving }: Args) => (
    <LiveProvider
      value={{
        connection,
        saving: saving ? { state: saving, failures: 1 } : undefined,
      }}
    >
      <DocumentStatus />
    </LiveProvider>
  ),
  parameters: { layout: "centered" },
} satisfies Meta<Args>;

export default meta;

type Story = StoryObj<Args>;

/** Everything typed here has reached the server, and changes are crossing. */
export const Saved: Story = {
  args: { connection: "live", saving: "saved" },
  play: async () => {
    await expect(screen.getByRole("status")).toHaveTextContent("Saved");
  },
};

/** There is something written here the server has not taken yet. */
export const Saving: Story = {
  args: { connection: "live", saving: "saving" },
  play: async () => {
    await expect(screen.getByRole("status")).toHaveTextContent("Saving");
  },
};

/**
 * The one worth interrupting for: what was typed is on this computer and has
 * not reached the server.
 */
export const NotSaved: Story = {
  args: { connection: "offline", saving: "offline" },
  play: async () => {
    const status = screen.getByRole("status");

    await expect(status).toHaveTextContent("Not saved");

    // Not saved outranks not live: one of the two is about losing work.
    await expect(status).not.toHaveTextContent("Not live");

    await userEvent.hover(status);
    await expect(
      await screen.findByText(/has not reached the server/),
    ).toBeVisible();
  },
};

/**
 * Saving is fine, but nobody else's changes are arriving — worth saying,
 * because a document that is quietly not live looks exactly like one nobody
 * else is editing.
 */
export const NotLive: Story = {
  args: { connection: "offline", saving: "saved" },
  play: async () => {
    await expect(screen.getByRole("status")).toHaveTextContent("Not live");
  },
};

/** Looking for the connection again, with what was typed kept meanwhile. */
export const Reconnecting: Story = {
  args: { connection: "connecting", saving: "saved" },
  play: async () => {
    await expect(screen.getByRole("status")).toHaveTextContent("Reconnecting");
  },
};

/**
 * On a surface that is not a document — the edit modal over the database — this
 * has nothing to report and says nothing.
 */
export const NotADocument: Story = {
  args: {},
  play: async () => {
    await expect(screen.queryByRole("status")).not.toBeInTheDocument();
  },
};
