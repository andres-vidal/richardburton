import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, waitFor } from "storybook/test";

import { ContactModal } from "./ContactModal";

const meta = {
  title: "Components/Contact modal",
  component: ContactModal,
  tags: ["autodocs"],
  args: {},
  parameters: {
    layout: "fullscreen",
    // Portalled full-screen modal — render it bounded on the docs page so it
    // doesn't cover everything (same as AppLoader).
    docs: { story: { inline: false, height: "42rem" } },
  },
} satisfies Meta<typeof ContactModal>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Open state — the modal is driven by the `?contact=true` URL query. Renders
 * the contact form; the story asserts its content without submitting (the real
 * form POSTs to `/contact`).
 */
export const Default: Story = {
  parameters: { nextjs: { navigation: { query: { contact: "true" } } } },
  play: async () => {
    await waitFor(() =>
      expect(screen.getByText("Contact Us")).toBeInTheDocument(),
    );
    await expect(
      screen.getByRole("button", { name: "Send" }),
    ).toBeInTheDocument();
  },
};
