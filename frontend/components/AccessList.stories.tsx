import type { Meta, StoryObj } from "@storybook/react";
import { SessionProvider } from "modules/session";
import type { UserRecord } from "modules/users";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import AccessList from "./AccessList";

const ME: UserRecord = {
  id: 1,
  email: "me@rb.test",
  role: "admin",
  insertedAt: "2026-01-04T10:00:00",
};

const USERS: UserRecord[] = [
  ME,
  {
    id: 2,
    email: "curator@rb.test",
    role: "contributor",
    insertedAt: "2026-03-11T10:00:00",
  },
  {
    id: 3,
    email: "someone@rb.test",
    role: "reader",
    insertedAt: "2026-07-02T10:00:00",
  },
];

const meta = {
  title: "Access/People",
  component: AccessList,
  args: { users: USERS },
  // The list reads the session to know which row is the reader's own.
  decorators: [
    (Story) => (
      <SessionProvider session={ME}>
        <Story />
      </SessionProvider>
    ),
  ],
} satisfies Meta<typeof AccessList>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Everyone with access, each row saying what that access amounts to. */
export const Default: Story = {
  play: async () => {
    await expect(screen.getByText("curator@rb.test")).toBeInTheDocument();
    await expect(
      screen.getByText(/Can add and correct publications/),
    ).toBeInTheDocument();
    await expect(screen.getByText(/decide who else may/)).toBeInTheDocument();
  },
};

/**
 * Your own row is shown but not editable: another admin can demote or remove
 * you, and having to ask is what stops a slip from locking you out.
 */
export const YourOwnRow: Story = {
  play: async () => {
    await expect(screen.getByText("(you)")).toBeInTheDocument();
    await expect(screen.getByLabelText("Role for me@rb.test")).toBeDisabled();

    const [mine] = screen.getAllByRole("button", { name: "Revoke" });
    await expect(mine).toBeDisabled();
  },
};

/** Someone else's row offers the roles, one of which they already hold. */
export const ChangingSomeoneElsesRole: Story = {
  parameters: {
    // Floating UI's focus guards (tabindex=0 + aria-hidden) trip axe's
    // aria-hidden-focus rule as a false positive; silence just that rule for the
    // story that leaves the menu open, as MenuProvider's own stories do.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async () => {
    const menu = screen.getByLabelText("Role for curator@rb.test");
    await expect(menu).toBeEnabled();

    await userEvent.click(menu);

    const options = await screen.findAllByRole("option");
    await expect(options.map((option) => option.textContent)).toEqual([
      "Reader",
      "Contributor",
      "Administrator",
    ]);
  },
};

/**
 * Revoking asks first, and names who it is about — the row it was clicked from
 * is not visible once a dialog is over it.
 */
export const RevokingAsksFirst: Story = {
  play: async () => {
    const [, theirs] = screen.getAllByRole("button", { name: "Revoke" });
    await userEvent.click(theirs);

    const dialog = await screen.findByRole("dialog", {
      name: "Revoke this access?",
    });
    await expect(dialog).toHaveTextContent("curator@rb.test");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};
