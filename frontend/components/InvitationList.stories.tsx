import type { Meta, StoryObj } from "@storybook/react";
import type { Invitation } from "modules/access/model";
import { expect, screen } from "storybook/test";

import InvitationList from "./InvitationList";

const INVITATIONS: Invitation[] = [
  {
    id: 1,
    email: "waiting@rb.test",
    role: "contributor",
    acceptedAt: null,
    insertedAt: "2026-07-26T09:00:00",
  },
  {
    id: 2,
    email: "arrived@rb.test",
    role: "admin",
    acceptedAt: "2026-07-24T11:30:00",
    insertedAt: "2026-07-20T09:00:00",
  },
];

const meta = {
  title: "Access/Invitations",
  component: InvitationList,
  args: { invitations: INVITATIONS },
} satisfies Meta<typeof InvitationList>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * One waiting and one taken up. A taken-up invitation stays listed — it records
 * how someone came to have what they have — but there is nothing left to chase,
 * so it offers no actions.
 */
export const Default: Story = {
  play: async () => {
    await expect(screen.getByText("waiting")).toBeInTheDocument();
    await expect(screen.getByText("taken up")).toBeInTheDocument();

    // Only the pending one can be chased.
    await expect(
      screen.getAllByRole("button", { name: "Send again" }),
    ).toHaveLength(1);
    await expect(
      screen.getAllByRole("button", { name: "Withdraw" }),
    ).toHaveLength(1);
  },
};

/** Nobody has been invited yet — say so rather than showing an empty list. */
export const Empty: Story = {
  args: { invitations: [] },
  play: async () => {
    await expect(screen.getByText(/No invitations yet/)).toBeInTheDocument();
  },
};
