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

/** The button shows the name of the role `value`. */
export const Default: Story = {
  play: async () => {
    await expect(
      screen.getByRole("combobox", { name: "Role" }),
    ).toHaveTextContent("Contributor");
  },
};

/** Opened, the menu offers every role, least privileged first. */
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

/** Choosing another role calls `onChange` with it. */
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

/** Choosing the role already shown does not call `onChange`. */
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

/** Disabled, the button cannot be pressed. */
export const Disabled: Story = {
  args: { disabled: true },
  play: async () => {
    await expect(screen.getByRole("combobox", { name: "Role" })).toBeDisabled();
  },
};
