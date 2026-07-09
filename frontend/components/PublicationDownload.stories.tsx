import type { Meta, StoryObj } from "@storybook/react";
import { seed } from "modules/publication/fixtures";
import { expect, within } from "storybook/test";

import PublicationDownload from "./PublicationDownload";

const meta = {
  title: "Publications/Download",
  component: PublicationDownload,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationDownload>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Enabled when there are visible publications to export as .csv. */
export const Default: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", {
      name: /Download \.csv/,
    });
    await expect(button).toBeInTheDocument();
    // Do NOT click — the download issues a GET and creates an object URL.
    await expect(button).toBeEnabled();
  },
};

/** Nothing to download — the button is disabled when the list is empty. */
export const Empty: Story = {
  beforeEach: () => seed([]),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /Download \.csv/ }),
    ).toBeDisabled();
  },
};
