import type { Meta, StoryObj } from "@storybook/react";
import { publicationIdsAtom, setField } from "modules/publication/store";
import { store } from "modules/store";
import { fieldErrors, seed } from "test/publication-fixtures";
import { expect, within } from "storybook/test";

import PublicationSubmit from "./PublicationSubmit";

const meta = {
  title: "Publications/Submit",
  component: PublicationSubmit,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationSubmit>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Enabled when every visible publication is valid — the happy path. */
export const Default: Story = {
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", {
      name: "Submit",
    });
    await expect(button).toBeInTheDocument();
    // Do NOT click — submitting POSTs to the backend. Just assert it's enabled.
    await expect(button).toBeEnabled();
  },
};

/** Nothing to submit — the button is disabled when there are no publications. */
export const Empty: Story = {
  beforeEach: () => seed(store, []),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Submit" }),
    ).toBeDisabled();
  },
};

/** An invalid row blocks submission — the button stays disabled. */
export const WithInvalidRow: Story = {
  beforeEach: () =>
    seed(store, [
      { title: "Dom Casmurro", authors: ["Helen Caldwell"], year: "1953" },
      { title: "", errors: fieldErrors({ title: "required" }) },
    ]),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Submit" }),
    ).toBeDisabled();
  },
};

/**
 * A row edited after its last validation. Its stored result describes the old
 * content, so the button stays disabled until the row is checked again.
 */
export const WithUncheckedRow: Story = {
  beforeEach: () => {
    seed(store);
    const [first] = store.get(publicationIdsAtom) ?? [];
    setField(store, first, "title", "Dom Casmurro, revised");
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Submit" }),
    ).toBeDisabled();
  },
};
