import type { Meta, StoryObj } from "@storybook/react";
import { LiveProvider } from "modules/publication/presence";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";

import WorkspaceShare from "./WorkspaceShare";

const MEMBERS = [{ id: 2, email: "colleague@rb.test" }];

/**
 * Awareness with somebody else already in it, which is what a second person
 * having the workspace open looks like from here.
 */
function withOthers(emails: string[]) {
  const awareness = new Awareness(new Y.Doc());

  emails.forEach((email, index) =>
    awareness.states.set(awareness.clientID + index + 1, {
      user: { email },
    }),
  );

  return awareness;
}

const meta = {
  title: "Publications/Workspace share",
  component: WorkspaceShare,
  args: {
    read: async () => ({ members: MEMBERS }),
    invite: async () => {},
  },
  decorators: [
    (Story) => (
      <LiveProvider value={{ workspace: 1, awareness: withOthers([]) }}>
        <div className="flex gap-2 items-center p-8 bg-white">
          <Story />
        </div>
      </LiveProvider>
    ),
  ],
} satisfies Meta<typeof WorkspaceShare>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Who may open the workspace, and the way to let somebody else in. */
export const Default: Story = {
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Share" }));

    const dialog = await screen.findByRole("dialog", { name: "Share" });
    await expect(dialog).toHaveTextContent("colleague@rb.test");
  },
};

/**
 * Membership is by the address someone signed in with, so an address nobody
 * has used says so rather than appearing to work.
 */
export const NobodyByThatAddress: Story = {
  args: {
    invite: async () => {
      throw new Error("no_such_user");
    },
  },
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Share" }));

    const dialog = await screen.findByRole("dialog", { name: "Share" });
    await userEvent.type(dialog.querySelector("input")!, "nobody@rb.test");
    await userEvent.click(screen.getByRole("button", { name: "Let them in" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Nobody has signed in with that address/,
      ),
    );
  },
};

/**
 * Who is looking at the workspace right now, which is not the same as who may
 * open it: presence is true only while someone is there, and is never stored.
 */
export const SomeoneElseIsHere: Story = {
  decorators: [
    (Story) => (
      <LiveProvider
        value={{
          workspace: 1,
          awareness: withOthers(["colleague@rb.test", "editor@rb.test"]),
        }}
      >
        <div className="flex gap-2 items-center p-8 bg-white">
          <Story />
        </div>
      </LiveProvider>
    ),
  ],
  play: async () => {
    const here = await screen.findByRole("list", { name: "Here now" });

    await expect(here).toBeVisible();
    await expect(screen.getByLabelText("colleague@rb.test")).toHaveTextContent(
      "C",
    );
    await expect(screen.getByLabelText("editor@rb.test")).toHaveTextContent(
      "E",
    );
  },
};

/** A surface that belongs to no workspace has nobody to share it with. */
export const NoWorkspace: Story = {
  decorators: [
    (Story) => (
      <LiveProvider value={{}}>
        <div className="flex gap-2 items-center p-8 bg-white">
          <Story />
        </div>
      </LiveProvider>
    ),
  ],
  play: async () => {
    await expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  },
};
