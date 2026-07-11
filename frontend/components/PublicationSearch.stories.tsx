import type { Meta, StoryObj } from "@storybook/react";
import { seed } from "modules/publication/fixtures";
import { isIndexLoadingAtom } from "modules/publication/store";
import { store } from "modules/store";
import { expect, userEvent, waitFor, within } from "storybook/test";

import PublicationSearch from "./PublicationSearch";

const meta = {
  title: "Publications/Publication search",
  component: PublicationSearch,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PublicationSearch>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The search input renders and is initially empty. */
export const Default: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Search publications",
    });
    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue("");
  },
};

/** A `?search=` param (e.g. following a keyword link) is mirrored into the box. */
export const FromUrlParam: Story = {
  parameters: { nextjs: { navigation: { query: { search: "Machado" } } } },
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Search publications",
    });
    await expect(input).toHaveValue("Machado");
  },
};

/** While a search is in flight, the keyword line becomes an animated status. */
export const Searching: Story = {
  beforeEach: () => {
    seed();
    store.set(isIndexLoadingAtom, true);
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Searching the collection/i),
    ).toBeInTheDocument();
  },
};

/** Typing into the input updates its value (debounces to the index endpoint). */
export const Typing: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Search publications",
    });
    await userEvent.type(input, "Machado");
    await waitFor(() => expect(input).toHaveValue("Machado"));
  },
};
