import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor, within } from "storybook/test";

import AppLoader from "./AppLoader";

const meta = {
  title: "Components/App Loader",
  component: AppLoader,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    // AppLoader is a portalled, `fixed inset-0` full-screen overlay. On the docs
    // page a `FloatingPortal` escapes the inline canvas and covers the whole
    // page, so render it in a bounded iframe instead.
    docs: { story: { inline: false, height: "22rem" } },
  },
} satisfies Meta<typeof AppLoader>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A full-screen modal overlay shown while a request is in flight. */
export const Default: Story = {
  play: async () => {
    // AppLoader renders into a floating portal, so it lands on document.body.
    const body = within(document.body);
    await waitFor(() => expect(body.getByRole("dialog")).toBeInTheDocument());
  },
};
