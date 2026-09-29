import type { Meta, StoryObj } from "@storybook/react";
import { aDocumentWith } from "modules/publication/fixtures";
import { LiveProvider } from "modules/publication/presence";
import { expect, screen, userEvent, within } from "storybook/test";

import DocumentPresence from "./DocumentPresence";

type Args = { here: { email: string }[] };

const meta = {
  title: "Publications/Document presence",
  render: ({ here }: Args) => (
    <LiveProvider {...aDocumentWith(here)} connection="live" saving="saved">
      <DocumentPresence />
    </LiveProvider>
  ),
  parameters: { layout: "centered" },
} satisfies Meta<Args>;

export default meta;

type Story = StoryObj<Args>;

/** Two other people have the document open. Each is shown as their initial. */
export const OthersHere: Story = {
  args: {
    here: [{ email: "helen@example.com" }, { email: "isabel@example.com" }],
  },
  play: async () => {
    const list = screen.getByRole("list", { name: "Also here" });

    await expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    await expect(
      within(list).getByLabelText("helen@example.com"),
    ).toHaveTextContent("H");
  },
};

/**
 * A person with the document open in two tabs is shown once. The server tracks
 * each connection, and the list groups them by email.
 */
export const OnePersonInTwoTabs: Story = {
  args: {
    here: [{ email: "helen@example.com" }, { email: "helen@example.com" }],
  },
  play: async () => {
    const list = screen.getByRole("list", { name: "Also here" });

    await expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  },
};

/** Hovering a person's initial shows a tooltip with their email. */
export const NamedOnHover: Story = {
  args: { here: [{ email: "helen@example.com" }] },
  play: async () => {
    await userEvent.hover(screen.getByLabelText("helen@example.com"));

    await expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "helen@example.com is working on this too",
    );
  },
};

/** With nobody else in the document, the component renders nothing. */
export const Alone: Story = {
  args: { here: [] },
  play: async () => {
    await expect(
      screen.queryByRole("list", { name: "Also here" }),
    ).not.toBeInTheDocument();
  },
};
