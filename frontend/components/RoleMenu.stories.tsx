import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent } from "storybook/test";

import RoleMenu from "./RoleMenu";

const meta = {
  title: "Access/Role menu",
  component: RoleMenu,
  args: { value: "contributor", label: "Role", onChange: fn() },
  parameters: { layout: "centered" },
} satisfies Meta<typeof RoleMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Shows the role held; opening it offers the others. */
export const Default: Story = {
  play: async () => {
    await expect(
      screen.getByRole("combobox", { name: "Role" }),
    ).toHaveTextContent("Contributor");
  },
};

/** The roles, least privileged first, in the app's own menu. */
export const Open: Story = {
  parameters: {
    // Floating UI's focus guards (tabindex=0 + aria-hidden) trip axe's
    // aria-hidden-focus rule as a false positive; silence just that rule for the
    // story that leaves the menu open, as MenuProvider's own stories do.
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async () => {
    await userEvent.click(screen.getByRole("combobox", { name: "Role" }));

    const options = await screen.findAllByRole("option");
    await expect(options.map((option) => option.textContent)).toEqual([
      "Reader",
      "Contributor",
      "Administrator",
    ]);
  },
};

/** Choosing another role reports it, and the trigger takes its name. */
export const ChoosingAnotherRole: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ args }) => {
    await userEvent.click(screen.getByRole("combobox", { name: "Role" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Administrator" }),
    );

    await expect(args.onChange).toHaveBeenCalledWith("admin");
  },
};

/** Choosing the role already held changes nothing, so nothing is reported. */
export const ChoosingTheSameRole: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ args }) => {
    await userEvent.click(screen.getByRole("combobox", { name: "Role" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Contributor" }),
    );

    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

/** A row that cannot be changed — your own, or one mid-flight — offers nothing. */
export const Disabled: Story = {
  args: { disabled: true },
  play: async () => {
    await expect(screen.getByRole("combobox", { name: "Role" })).toBeDisabled();
  },
};
