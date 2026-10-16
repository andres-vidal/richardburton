import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, within } from "storybook/test";
import {
  BARE_LINKS,
  EVERY_FORMAT,
  item,
  link,
  paragraph,
} from "test/rich-text-fixtures";

import RichText from "./RichText";

const meta = {
  title: "Components/Rich text",
  component: RichText,
  decorators: [
    (Story) => (
      <div className="p-6 w-lg max-w-full bg-white" data-testid="frame">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof RichText>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Rich text in every format: paragraphs, a line break, bold and italic text, a
 * bulleted list with a numbered list nested in it, and a link, which opens in a
 * new tab and passes on neither the page nor its address.
 */
export const Default: Story = {
  args: { value: EVERY_FORMAT },
  play: async () => {
    const link = screen.getByRole("link", { name: "the guide" });

    await expect(link).toHaveAttribute("href", "https://example.com/guide");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");

    await expect(screen.getByText("bold").tagName).toBe("STRONG");
    await expect(screen.getAllByRole("list")).toHaveLength(2);
    await expect(
      within(screen.getAllByRole("list")[1]).getAllByRole("listitem"),
    ).toHaveLength(2);
  },
};

/**
 * Runs of list items as nested lists. Consecutive items of one kind share a
 * list, an item of the other kind starts a new one, an item that skips a
 * level sits one level deeper than the item before it, and a paragraph ends
 * the lists.
 */
export const Lists: Story = {
  args: {
    value: [
      item("numbered", 0, "Editions"),
      item("bulleted", 1, "Cloth"),
      item("bulleted", 2, "Signed by the translator"),
      item("numbered", 0, "Reviews"),
      item("bulleted", 2, "The Nation"),
      item("bulleted", 0, "Unsorted"),
      paragraph("Then a paragraph."),
      item("numbered", 0, "A new list"),
    ],
  },
  play: async ({ canvasElement }) => {
    const top = [
      ...canvasElement.querySelectorAll<HTMLElement>(
        "[data-size] > ol, [data-size] > ul",
      ),
    ];
    // Returns the list item that holds the list `text` is an item of.
    const parentItem = (text: string) =>
      screen.getByText(text).parentElement?.closest("li");

    await expect(top.map((list) => list.tagName)).toEqual(["OL", "UL", "OL"]);
    await expect(top[0].querySelectorAll(":scope > li")).toHaveLength(2);
    await expect(parentItem("Signed by the translator")).toBe(
      screen.getByText("Cloth"),
    );
    await expect(parentItem("The Nation")).toBe(screen.getByText("Reviews"));
    await expect(parentItem("Reviews")).toBeNull();
    await expect(within(top[2]).getByText("A new list")).toBeVisible();
  },
};

/** A bare URL and an email address in the text render as links. */
export const BareLinks: Story = {
  args: { value: BARE_LINKS },
  play: async () => {
    await expect(
      screen.getByRole("link", { name: "https://example.com/guide" }),
    ).toHaveAttribute("href", "https://example.com/guide");
    await expect(
      screen.getByRole("link", { name: "help@example.org" }),
    ).toHaveAttribute("href", "mailto:help@example.org");
  },
};

/**
 * Text that Markdown or HTML would read as formatting is shown as it is
 * written, and a link to anything but a web or email address is its text
 * alone.
 */
export const LiteralText: Story = {
  args: {
    value: [
      paragraph("Two editions: *1965* and <b>1971</b>\n- one copy"),
      paragraph("Run ", link("javascript:alert(1)", "this script"), "."),
    ],
  },
  play: async () => {
    const frame = screen.getByTestId("frame");

    await expect(
      within(frame).getByText(/Two editions: \*1965\* and <b>1971<\/b>/),
    ).toBeInTheDocument();
    await expect(frame.querySelector("b, em, strong, li")).toBeNull();
    await expect(within(frame).queryByRole("link")).toBeNull();
    await expect(within(frame).getByText("Run this script.")).toBeVisible();
  },
};

/** The smaller text, with less space between blocks. */
export const Small: Story = {
  args: {
    value: [
      paragraph("A short note. ", { text: "Read it twice.", bold: true }),
      item("bulleted", 0, "one copy"),
      item("bulleted", 0, { text: "two", italic: true }, " copies"),
    ],
    size: "small",
  },
};

/** No value, or a blank one, renders nothing. */
export const Empty: Story = {
  args: { value: [paragraph("  "), item("bulleted", 0, "")] },
  play: async () => {
    await expect(screen.getByTestId("frame")).toBeEmptyDOMElement();
  },
};
