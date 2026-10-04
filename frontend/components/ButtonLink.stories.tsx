import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import ButtonLink from "./ButtonLink";

const meta = {
  title: "Components/Button link",
  component: ButtonLink,
  parameters: { layout: "centered" },
  args: {
    label: "Open",
    href: "/admin/publications/documents/1",
    variant: "outline-primary",
  },
} satisfies Meta<typeof ButtonLink>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A link to another page that looks like an outlined button. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: "Open" }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/admin/publications/documents/1"),
    );
  },
};

/**
 * An accessible name that says what the link opens, for a label that only
 * says what it does, as in a list where every entry has an **Open**.
 */
export const NamedForWhatItOpens: Story = {
  args: { "aria-label": "Open Second pass, 2026" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", {
        name: "Open Second pass, 2026",
      }),
    ).toHaveTextContent("Open");
  },
};

/** With `newTab`, the page opens in a new tab that gets no access to this one. */
export const InANewTab: Story = {
  args: { label: "Open “Set aside” in a new tab", newTab: true },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link");

    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  },
};

/** The same variants as `Button`, from the class list the two share. */
export const Primary: Story = {
  args: { label: "Start a document", variant: "primary" },
};
