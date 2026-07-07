import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";

import Button from "./Button";

/** A tiny self-contained icon so these stories don't depend on app SVG assets. */
const PlusIcon = ({ className }: { className: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const meta = {
  title: "Components/Button",
  component: Button,
  args: { label: "Click me", onClick: fn() },
  parameters: { layout: "centered" },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Interactive default — tweak any prop in Controls. Also verifies a click fires `onClick`. */
export const Playground: Story = {
  args: { width: "fit" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Click me" });

    await expect(button).toBeEnabled();
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

/** The four visual variants, side by side. */
export const Variants: Story = {
  args: { width: "fit" },
  render: (args) => (
    <div className="flex flex-wrap gap-3 items-center">
      <Button {...args} variant="primary" label="Primary" />
      <Button {...args} variant="secondary" label="Secondary" />
      <Button {...args} variant="outline" label="Outline" />
      <Button {...args} variant="danger" label="Danger" />
    </div>
  ),
};

/** `width`: `full` fills its container, `fixed` is a set width, `fit` hugs its content. */
export const Widths: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3 p-3 w-80 rounded border border-gray-300 border-dashed">
      <Button {...args} width="full" label="full" />
      <Button {...args} width="fixed" label="fixed" />
      <Button {...args} width="fit" label="fit" />
    </div>
  ),
};

/** `alignment` positions the content within the button — visible once it's wider than its content. */
export const Alignment: Story = {
  args: { width: "fixed", Icon: PlusIcon },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <Button {...args} alignment="center" label="center" />
      <Button {...args} alignment="left" label="left" />
    </div>
  ),
};

/** An `Icon` renders before the label, inheriting the button's text color. */
export const WithIcon: Story = {
  args: { Icon: PlusIcon, width: "fit" },
  render: (args) => (
    <div className="flex flex-wrap gap-3 items-center">
      <Button {...args} variant="primary" label="Add" />
      <Button {...args} variant="outline" label="Add" />
    </div>
  ),
};

/**
 * `labelSrOnly` hides the label visually but keeps it as the button's accessible
 * name — the pattern for icon-only buttons.
 */
export const IconOnly: Story = {
  args: {
    Icon: PlusIcon,
    labelSrOnly: true,
    width: "fit",
    label: "Add publication",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The label is visually hidden, yet still the button's accessible name.
    await expect(
      canvas.getByRole("button", { name: "Add publication" }),
    ).toBeInTheDocument();
  },
};

/**
 * `loading` disables the button and blocks clicks, but keeps the variant color
 * in a darker shade so it reads as "busy" — distinct from a plain `disabled`
 * button, which greys out to read as "unavailable". Shown together for contrast.
 */
export const States: Story = {
  args: { width: "fit" },
  render: (args) => (
    <div className="flex flex-wrap gap-3 items-center">
      <Button {...args} label="Default" />
      <Button {...args} label="Loading" loading />
      <Button {...args} label="Disabled" disabled />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const loading = canvas.getByRole("button", { name: "Loading" });

    // Loading is disabled and swallows clicks.
    await expect(loading).toBeDisabled();
    await userEvent.click(loading);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
