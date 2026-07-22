import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import Breadcrumb from "./Breadcrumb";

const meta = {
  title: "Components/Breadcrumb",
  component: Breadcrumb,
  args: {
    items: [
      { label: "Home", href: "/" },
      { label: "Admin", href: "/admin" },
      { label: "Backfill references" },
    ],
  },
  decorators: [
    (Story) => (
      <div className="p-8 min-h-screen bg-white">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof Breadcrumb>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Ancestors are links; the current page is the plain last crumb. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    await expect(canvas.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/admin",
    );
    // The current page is announced but not a link.
    await expect(canvas.getByText("Backfill references")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      canvas.queryByRole("link", { name: "Backfill references" }),
    ).not.toBeInTheDocument();
  },
};
