import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import PublicationSearch from "./PublicationSearch";

const meta = {
  title: "Publications/Publication search",
  component: PublicationSearch,
  args: { matched: [] },
  parameters: { layout: "padded" },
} satisfies Meta<typeof PublicationSearch>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The search input renders and is initially empty. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Search publications",
    });
    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue("");
  },
};

/** The box shows the `search` query parameter of the address. */
export const FromUrlParam: Story = {
  parameters: { nextjs: { navigation: { query: { search: "Machado" } } } },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Search publications",
    });
    await expect(input).toHaveValue("Machado");
  },
};

/**
 * While what was typed has not reached the address, the line under the box
 * says that the search is running.
 */
export const Searching: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox"), "mach");

    await waitFor(() =>
      expect(canvas.getByText(/Searching the collection/i)).toBeInTheDocument(),
    );
  },
};

/** Typing shows in the box at once. The address follows after a pause. */
export const Typing: Story = {
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
  args: {
    matched: [
      {
        field: null,
        typed: "Maries",
        words: ["marie", "maria", "mario", "marias"],
      },
    ],
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
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole("button", { name: "Show all" }),
    ).toBeNull();
  },
};

/**
 * Each word of the report links to a search for that word alone, relative to
 * the current page.
 */
export const GivenMatches: Story = {
  parameters: { nextjs: { navigation: { query: { search: "clarise" } } } },
  args: {
    matched: [
      { field: null, typed: "clarise", words: ["clarice", "clara", "clarke"] },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("link", { name: "clarice" }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "clarke" })).toHaveAttribute(
      "href",
      "?search=clarke",
    );
  },
};
