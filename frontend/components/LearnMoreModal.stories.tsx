import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, waitFor } from "storybook/test";

import { LearnMoreModal } from "./LearnMoreModal";

const meta = {
  title: "Components/Learn more modal",
  component: LearnMoreModal,
  tags: ["autodocs"],
  args: {},
  parameters: {
    layout: "fullscreen",
    // Portalled full-screen modal — render it bounded on the docs page.
    docs: { story: { inline: false, height: "40rem" } },
  },
} satisfies Meta<typeof LearnMoreModal>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Open state — driven by the `?learn-more=true` URL query. Shows the "About the
 * platform" article alongside the Richard & Isabel Burton aside.
 */
export const Default: Story = {
  parameters: { nextjs: { navigation: { query: { "learn-more": "true" } } } },
  play: async () => {
    await waitFor(() =>
      expect(
        screen.getByAltText("Portrait of Sir Richard Burton"),
      ).toBeInTheDocument(),
    );
    await expect(
      screen.getByText(/open access online repository/i),
    ).toBeInTheDocument();
  },
};
