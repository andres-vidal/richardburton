import type { Meta, StoryObj } from "@storybook/react";
import { seed } from "modules/publication/fixtures";
import { matchedAtom } from "modules/publication/store";
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
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Search publications",
    });
    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue("");
  },
};

/** A `?search=` param (e.g. following a matched-word link) is mirrored into the box. */
export const FromUrlParam: Story = {
  parameters: { nextjs: { navigation: { query: { search: "Machado" } } } },
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Search publications",
    });
    await expect(input).toHaveValue("Machado");
  },
};

/**
 * While a search is in flight, the matched line becomes an animated status. The
 * query lives in the URL and the results are read for it, so "in flight" is what
 * has been typed not having reached the URL yet.
 */
export const Searching: Story = {
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox"), "mach");

    await waitFor(() =>
      expect(canvas.getByText(/Searching the collection/i)).toBeInTheDocument(),
    );
  },
};

/** Typing into the input updates its value (debounces to the index endpoint). */
export const Typing: Story = {
  beforeEach: () => seed(store),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Search publications",
    });
    await userEvent.type(input, "Machado");
    await waitFor(() => expect(input).toHaveValue("Machado"));
  },
};

/**
 * A term the index could not match as typed reports what it matched instead.
 * The report is one clipped line until "Show all" opens it, and closes again
 * from the same control.
 */
export const Widened: Story = {
  parameters: { nextjs: { navigation: { query: { search: "Maries" } } } },
  beforeEach: () => {
    seed(store);
    store.set(matchedAtom, [
      {
        field: null,
        typed: "Maries",
        words: ["marie", "maria", "mario", "marias"],
      },
    ]);
    return () => store.set(matchedAtom, undefined);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const report = canvasElement.querySelector("#search-report");

    await expect(report).toHaveAttribute("data-expanded", "false");

    await userEvent.click(canvas.getByRole("button", { name: "Show all" }));
    await waitFor(() =>
      expect(report).toHaveAttribute("data-expanded", "true"),
    );

    await userEvent.click(canvas.getByRole("button", { name: "Show less" }));
    await waitFor(() =>
      expect(report).toHaveAttribute("data-expanded", "false"),
    );
  },
};

/**
 * A term the index took as written reports nothing — there is no widening to
 * disclose — so there is nothing to open either.
 */
export const TakenAsWritten: Story = {
  parameters: { nextjs: { navigation: { query: { search: "machado" } } } },
  beforeEach: () => {
    seed(store);
    store.set(matchedAtom, []);
    return () => store.set(matchedAtom, undefined);
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole("button", { name: "Show all" }),
    ).toBeNull();
  },
};
