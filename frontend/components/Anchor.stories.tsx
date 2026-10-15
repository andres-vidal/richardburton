import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";

import Anchor from "./Anchor";

const meta = {
  title: "Components/Anchor",
  component: Anchor,
  args: { href: "/publications", children: "Browse publications" },
  // Anchor takes the colour of the text around it, so the stories set white
  // text on indigo.
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

/**
 * A link within the app. The play test checks that the path gets the current
 * locale.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "Browse publications" });
    await expect(link).toBeInTheDocument();
    await expect(link).toHaveAttribute("href", "/en/publications");
  },
};

/**
 * An `href` starting with `http` renders a plain `<a>`. The play test checks
 * that the address is left as it is.
 */
export const External: Story = {
  args: { href: "https://example.com", children: "Visit example" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "Visit example" });
    await expect(link).toHaveAttribute("href", "https://example.com");
  },
};

/**
 * Given something to do rather than somewhere to go, it is a button — same
 * treatment, so the header's one action sits in the row with the links.
 */
export const AsAnAction: Story = {
  args: { href: undefined, onClick: fn(), children: "Sign out" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Sign out" }));
    await expect(args.onClick).toHaveBeenCalled();
  },
};

/** A `query` is appended to the `href`. The play test checks the address. */
export const WithQuery: Story = {
  args: { href: "/publications", query: "search=Machado", children: "Search" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: "Search" });
    await expect(link).toHaveAttribute(
      "href",
      "/en/publications?search=Machado",
    );
  },
};

/**
 * A link with only a `query` stays on the current page. The play test checks
 * that the address is only the query.
 */
export const QueryOnly: Story = {
  args: { href: undefined, query: "learn-more=true", children: "Learn More" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: "Learn More" }),
    ).toHaveAttribute("href", expect.stringContaining("?learn-more=true"));
  },
};
