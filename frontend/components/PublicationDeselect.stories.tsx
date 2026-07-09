import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";

import PublicationDeselect from "./PublicationDeselect";

const meta = {
  title: "Components/Publication Deselect",
  component: PublicationDeselect,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationDeselect>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Shows the current selection size and clears it when clicked. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // With nothing selected the button reads "Deselect 0".
    const button = canvas.getByRole("button", { name: /Deselect 0/ });
    await expect(button).toBeInTheDocument();
    // Clicking clears the selection — a safe no-op when already empty.
    await userEvent.click(button);
    await expect(button).toBeInTheDocument();
  },
};
