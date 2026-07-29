import type { Meta, StoryObj } from "@storybook/react";
import { receiveIndex } from "modules/publication/store";
import { store } from "modules/store";
import { expect, screen, userEvent } from "storybook/test";

import PublicationPages from "./PublicationPages";

/** A page's worth of results, and how many answered in all. */
const answered = (matching: number, perPage = 50) =>
  receiveIndex(store, {
    entries: [],
    keywords: [],
    total: matching,
    matching,
    perPage,
  });

const meta = {
  title: "Publications/Publication pages",
  component: PublicationPages,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationPages>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Which page is being read, and the way to the ones either side. */
export const Default: Story = {
  beforeEach: () => {
    answered(288);
  },
  play: async () => {
    await expect(screen.getByText("Page 1 of 6")).toBeVisible();
    await expect(
      screen.getByRole("button", { name: "Previous" }),
    ).toBeDisabled();
    await expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  },
};

/**
 * Results that fit on one page are not paged: there is nowhere to go, so
 * nothing is offered.
 */
export const OnlyOnePage: Story = {
  beforeEach: () => {
    answered(12);
  },
  play: async () => {
    await expect(
      screen.queryByRole("navigation", { name: "Pages" }),
    ).toBeNull();
  },
};

/**
 * Moving between pages is a navigation, so the page ends up in the address and
 * can be linked, reloaded and gone back to.
 */
export const GoingToTheNextPage: Story = {
  beforeEach: () => {
    answered(288);
  },
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await expect(
      screen.getByRole("navigation", { name: "Pages" }),
    ).toBeVisible();
  },
};
