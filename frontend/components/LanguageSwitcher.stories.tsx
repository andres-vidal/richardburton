import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";

import LanguageSwitcher from "./LanguageSwitcher";

const meta = {
  title: "Components/Language switcher",
  component: LanguageSwitcher,
  parameters: {
    layout: "centered",
    nextjs: { navigation: { pathname: "/", query: { search: "iracema" } } },
  },
} satisfies Meta<typeof LanguageSwitcher>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * In English, the switcher offers Portuguese. The play test presses it and
 * checks that the same page and query open under the Portuguese prefix.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", {
        name: "Switch to Português",
      }),
    );

    await expect(getRouter().replace.mock.lastCall?.[0]).toMatch(
      /^\/pt\b.*search=iracema/,
    );
  },
};
