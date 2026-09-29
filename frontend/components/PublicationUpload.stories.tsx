import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { seed } from "modules/publication/fixtures";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

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
  beforeEach: () => seed(store, []),
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
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /Upload\.csv/ }),
    ).toBeEnabled();
  },
};

/**
 * With rows in the document, the button asks for confirmation before opening
 * the file picker, because an upload replaces other people's rows too.
 */
export const ReplacingASharedDocument: Story = {
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: /Upload\.csv/ }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Replace everything in this document?",
    });

    await expect(dialog).toHaveTextContent(
      "Everyone working on this document loses them",
    );

    // Cancelling closes the dialog without replacing anything.
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Keep them" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "Replace everything in this document?",
        }),
      ).not.toBeInTheDocument(),
    );
  },
};
