import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen } from "storybook/test";

import { SearchHelpModal } from "./SearchHelpModal";

const meta = {
  title: "Components/Search Help",
  component: SearchHelpModal,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SearchHelpModal>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The search syntax reference. Open state lives in the URL, so the search it
 * documents stays on screen behind it.
 */
export const Open: Story = {
  parameters: {
    nextjs: { navigation: { pathname: "/", query: { "search-help": "true" } } },
  },
  play: async () => {
    const dialog = await screen.findByRole("dialog", { name: "How to search" });

    await expect(dialog).toBeVisible();
    // The tolerances that are not discoverable from the input itself.
    await expect(dialog).toHaveTextContent("Accents may be omitted");
    await expect(dialog).toHaveTextContent("misspellings are tolerated");
    // The operators, with an example of each form.
    await expect(dialog).toHaveTextContent("title:iracema");
    await expect(dialog).toHaveTextContent("year:1950-1960");
    await expect(dialog).toHaveTextContent("-country:US");
    await expect(dialog).toHaveTextContent(":or");
  },
};

/** Every operator accepts a Portuguese name. */
export const InPortuguese: Story = {
  parameters: {
    nextjs: { navigation: { pathname: "/", query: { "search-help": "true" } } },
  },
  play: async () => {
    const dialog = await screen.findByRole("dialog", { name: "How to search" });

    await expect(dialog).toHaveTextContent("autor:");
    await expect(dialog).toHaveTextContent("tradutor:");
    await expect(dialog).toHaveTextContent(":ou");
  },
};

/** Renders nothing when closed; the URL parameter controls it. */
export const Closed: Story = {
  parameters: { nextjs: { navigation: { pathname: "/" } } },
  play: async () => {
    await expect(screen.queryByRole("dialog")).toBeNull();
  },
};
