import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import Anchor from "./Anchor";

const meta = {
  title: "Components/Anchor",
  component: Anchor,
  tags: ["autodocs"],
  args: { href: "/publications", children: "Browse publications" },
  // Anchor sets no color of its own (its underline uses `bg-current`); it's only
  // used in the indigo header, so show it there — white text, hover-grow underline.
  decorators: [
    (Story) => (
      <div className="inline-flex rounded bg-indigo-600 px-6 py-3 text-white">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof Anchor>;

export default meta;

type Story = StoryObj<typeof meta>;

/** An internal link with an animated underline. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "Browse publications" });
    await expect(link).toBeInTheDocument();
    await expect(link).toHaveAttribute("href", "/publications");
  },
};

/** An external link (href starting with http) renders a plain anchor. */
export const External: Story = {
  args: { href: "https://example.com", children: "Visit example" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "Visit example" });
    await expect(link).toHaveAttribute("href", "https://example.com");
  },
};

/** An href plus a query string appends the query. */
export const WithQuery: Story = {
  args: { href: "/publications", query: "search=Machado", children: "Search" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "Search" });
    await expect(link).toHaveAttribute("href", "/publications?search=Machado");
  },
};
