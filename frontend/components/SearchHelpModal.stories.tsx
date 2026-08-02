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
 * What the search can do, said in the reader's terms. Opened from the address,
 * so the search being explained is still there behind it.
 */
export const Open: Story = {
  parameters: {
    nextjs: { navigation: { pathname: "/", query: { "search-help": "true" } } },
  },
  play: async () => {
    const dialog = await screen.findByRole("dialog", { name: "How to search" });

    await expect(dialog).toBeVisible();
    // The tolerances a reader could not guess from a text box.
    await expect(dialog).toHaveTextContent("Accents may be omitted");
    await expect(dialog).toHaveTextContent("misspellings are tolerated");
    // And the operators, with an example of each shape.
    await expect(dialog).toHaveTextContent("title:iracema");
    await expect(dialog).toHaveTextContent("year:1950-1960");
    await expect(dialog).toHaveTextContent("-country:US");
    await expect(dialog).toHaveTextContent(":or");
  },
};

/** Portuguese is not a footnote: every operator answers in it. */
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

/** Closed, it is nothing at all — the address says whether it is open. */
export const Closed: Story = {
  parameters: { nextjs: { navigation: { pathname: "/" } } },
  play: async () => {
    await expect(screen.queryByRole("dialog")).toBeNull();
  },
};
