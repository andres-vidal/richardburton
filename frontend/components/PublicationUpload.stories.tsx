import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { seed } from "test/publication-fixtures";
import { expect, screen, userEvent, within } from "storybook/test";

import PublicationUpload from "./PublicationUpload";

const meta = {
  title: "Publications/Upload",
  component: PublicationUpload,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationUpload>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * An empty document. The button opens a hidden file input, which the play test
 * checks is present without uploading anything.
 */
export const Default: Story = {
  beforeEach: () => seed(store, []),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", {
      name: /Upload\.csv/,
    });
    await expect(button).toBeEnabled();
    await expect(
      canvasElement.querySelector('input[type="file"]#upload-csv'),
    ).toBeInTheDocument();
  },
};

/**
 * A document that already has rows. The button is the same, and its tooltip
 * says that an upload adds the file's rows after them.
 */
export const WithExistingRows: Story = {
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    await userEvent.hover(
      within(canvasElement).getByRole("button", { name: /Upload\.csv/ }),
    );

    await expect(
      await screen.findByText(
        "Adds the rows of a .csv file after the rows already here.",
      ),
    ).toBeInTheDocument();
  },
};
