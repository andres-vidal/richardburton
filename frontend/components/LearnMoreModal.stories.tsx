import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, within } from "storybook/test";

import { LearnMoreModal } from "./LearnMoreModal";

const meta = {
  title: "Components/Learn more modal",
  component: LearnMoreModal,
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, height: "40rem" } },
  },
} satisfies Meta<typeof LearnMoreModal>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The modal opened by `?learn-more=true` in the URL: the article about the
 * platform, with the aside about Richard and Isabel Burton. The play test
 * checks both, and that a link to another site opens in a new tab that gets
 * no access to this one.
 */
export const Default: Story = {
  parameters: { nextjs: { navigation: { query: { "learn-more": "true" } } } },
  play: async () => {
    const dialog = await screen.findByRole("dialog", {
      name: "About the platform",
    });

    await expect(
      within(dialog).getByText(/open access online repository/i),
    ).toBeInTheDocument();
    await expect(
      within(dialog).getByAltText("Portrait of Sir Richard Burton"),
    ).toBeInTheDocument();

    const outward = within(dialog).getByRole("link", { name: "WyeWorks" });
    await expect(outward).toHaveAttribute("target", "_blank");
    await expect(outward).toHaveAttribute("rel", "noopener noreferrer");
  },
};

/** Without the URL parameter, nothing is rendered. */
export const Closed: Story = {
  play: async () => {
    await expect(screen.queryByRole("dialog")).toBeNull();
  },
};
