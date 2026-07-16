import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import Menu from "./Menu";
import MenuItem from "./MenuItem";

const meta = {
  title: "Components/Menu",
  component: Menu,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof Menu>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The bare scrollable list container — usually populated with `MenuItem`s. */
export const Default: Story = {
  render: (args) => (
    <Menu {...args} aria-label="Books">
      <MenuItem selected={false}>Dom Casmurro</MenuItem>
      <MenuItem selected>Memórias Póstumas</MenuItem>
      <MenuItem selected={false}>Quincas Borba</MenuItem>
    </Menu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The container is a listbox; its items are options.
    await expect(canvas.getByRole("listbox")).toBeInTheDocument();
    await expect(
      canvas.getByRole("option", { name: "Dom Casmurro" }),
    ).toBeInTheDocument();
  },
};

/**
 * `bordered` — the outlined dropdown that pairs with a bordered input (white,
 * bordered, `text-sm`), instead of the subtle borderless dense style.
 */
export const Bordered: Story = {
  args: { bordered: true },
  render: (args) => (
    <Menu {...args} aria-label="Books">
      <MenuItem selected={false}>Dom Casmurro</MenuItem>
      <MenuItem selected>Memórias Póstumas</MenuItem>
      <MenuItem selected={false}>Quincas Borba</MenuItem>
    </Menu>
  ),
  play: async ({ canvasElement }) => {
    const listbox = within(canvasElement).getByRole("listbox");
    await expect(getComputedStyle(listbox).borderTopWidth).toBe("1px");
    await expect(getComputedStyle(listbox).fontSize).toBe("14px");
  },
};
