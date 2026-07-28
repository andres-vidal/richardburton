import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent } from "storybook/test";

import InviteForm from "./InviteForm";

const meta = {
  title: "Access/Invite someone",
  component: InviteForm,
} satisfies Meta<typeof InviteForm>;

export default meta;

type Story = StoryObj<typeof meta>;

/** An address and a role. Contributor is the common case, so it leads. */
export const Default: Story = {
  play: async () => {
    await expect(screen.getByLabelText("Email address")).toHaveValue("");
    await expect(
      screen.getByRole("combobox", { name: "Role to invite as" }),
    ).toHaveTextContent("Contributor");
  },
};

/** The roles come from the app's own menu, not the platform's select. */
export const RoleMenuOpen: Story = {
  parameters: {
    // Floating UI's focus guards (tabindex=0 + aria-hidden) trip axe's
    // aria-hidden-focus rule as a false positive; silence just that rule for the
    // story that leaves the menu open, as MenuProvider's own stories do.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async () => {
    await userEvent.click(
      screen.getByRole("combobox", { name: "Role to invite as" }),
    );

    const menu = await screen.findByRole("listbox");
    await expect(menu).toBeInTheDocument();

    for (const role of ["Reader", "Contributor", "Administrator"]) {
      await expect(screen.getByRole("option", { name: role })).toBeVisible();
    }
  },
};

/** Nothing to send until an address is given. */
export const NothingTyped: Story = {
  play: async () => {
    await expect(screen.getByRole("button", { name: "Invite" })).toBeDisabled();
  },
};

/** Typing an address arms the button. */
export const AddressTyped: Story = {
  play: async () => {
    await userEvent.type(
      screen.getByLabelText("Email address"),
      "someone@example.com",
    );

    await expect(screen.getByRole("button", { name: "Invite" })).toBeEnabled();
  },
};
