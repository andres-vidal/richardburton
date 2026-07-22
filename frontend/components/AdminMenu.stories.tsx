import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import AdminMenu from "./AdminMenu";

// The admin hub: a card per admin tool. Linked from the home footer so admin
// actions live on one page instead of cluttering the footer.
const meta = {
  title: "Admin/Admin menu",
  component: AdminMenu,
  decorators: [
    (Story) => (
      <div className="p-8 min-h-screen bg-white">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AdminMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Each tool is a card linking to its route. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("link", { name: /Add publications/ }),
    ).toHaveAttribute("href", "/admin/publications/new");

    await expect(
      canvas.getByRole("link", { name: /Backfill references/ }),
    ).toHaveAttribute("href", "/admin/publications/references");
  },
};
