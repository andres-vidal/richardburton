import type { Meta, StoryObj } from "@storybook/react";
import { seed } from "modules/publication/fixtures";
import { expect, within } from "storybook/test";

import PublicationUpload from "./PublicationUpload";

const meta = {
  title: "Publications/Upload",
  component: PublicationUpload,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationUpload>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The upload trigger — a button that opens a hidden file input. */
export const Default: Story = {
  beforeEach: () => seed([]),
  play: async ({ canvasElement }) => {
    // The visible affordance is the button; the file input is hidden.
    const button = within(canvasElement).getByRole("button", {
      name: /Upload\.csv/,
    });
    await expect(button).toBeInTheDocument();
    await expect(button).toBeEnabled();
    // The hidden <input type="file"> backs it — assert it's present but don't
    // upload (uploading POSTs a FormData and replaces the store).
    const input = canvasElement.querySelector<HTMLInputElement>(
      'input[type="file"]#upload-csv',
    );
    await expect(input).toBeInTheDocument();
  },
};

/** With existing data, the button warns (via tooltip) that it will be replaced. */
export const WithExistingData: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /Upload\.csv/ }),
    ).toBeEnabled();
  },
};
