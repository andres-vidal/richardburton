import type { Meta, StoryObj } from "@storybook/react";
import { markedParagraph } from "modules/rich-text";
import { expect, screen, within } from "storybook/test";
import {
  EVERY_FORMAT,
  item,
  link,
  paragraph,
  unchecked,
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
 * list, an item of the other kind starts a new one, a deeper item is nested in
 * the item before it, and a paragraph ends the lists.
 */
export const Lists: Story = {
  args: {
    value: [
      item("numbered", 0, "Editions"),
      item("bulleted", 1, "Cloth"),
      item("bulleted", 2, "Signed by the translator"),
      item("numbered", 0, "Reviews"),
      item("bulleted", 1, "The Nation"),
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

/**
 * Text that Markdown or HTML would read as formatting is shown as it is
 * written. A URL or an email address in a run of text is text, and a link to
 * anything but a web or email address is its text alone.
 */
export const LiteralText: Story = {
  args: {
    value: [
      paragraph("Two editions: *1965* and <b>1971</b>\n- one copy"),
      paragraph(
        "Read https://example.com/guide, or write to help@example.org.",
      ),
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
    await expect(
      within(frame).getByText(
        "Read https://example.com/guide, or write to help@example.org.",
      ),
    ).toBeVisible();
    await expect(within(frame).getByText("Run this script.")).toBeVisible();
  },
};

/**
 * List items whose depths do not follow one another: a run that starts a
 * level deep, and an item that skips a level. Every item is shown. The play
 * test checks that each item is nested in the closest shallower item before
 * it, and that an item with none is in an outer list.
 */
export const UnevenDepths: Story = {
  args: {
    value: [
      item("bulleted", 1, "Starts a level deep"),
      item("bulleted", 0, "Editions"),
      item("bulleted", 2, "Skips a level"),
      item("bulleted", 1, "Comes back a level"),
    ],
  },
  play: async ({ canvasElement }) => {
    // Returns the list item that holds the list `text` is an item of.
    const parentItem = (text: string) =>
      screen.getByText(text).parentElement?.closest("li");

    await expect(
      canvasElement.querySelectorAll("[data-size] > ul > li"),
    ).toHaveLength(2);
    await expect(parentItem("Starts a level deep")).toBeNull();
    await expect(parentItem("Editions")).toBeNull();
    await expect(parentItem("Skips a level")).toBe(
      screen.getByText("Editions"),
    );
    await expect(parentItem("Comes back a level")).toBe(
      screen.getByText("Editions"),
    );
  },
};

/**
 * Values that are not rich text: a string of Markdown, and a value holding a
 * node of a type rich text does not have. Each renders as the text it holds.
 * The play test checks that the string keeps its line breaks and that its
 * Markdown is text, and that the unknown node shows the text of its children.
 */
export const UnrecognisedValues: Story = {
  args: { value: unchecked("Two editions:\n- *1965*, cloth\n- 1971, paper") },
  render: (args) => (
    <div className="space-y-4">
      <RichText {...args} />
      <RichText
        value={unchecked([
          paragraph("Before the quote."),
          {
            type: "block-quote",
            children: [
              { type: "paragraph", children: [{ text: "A quoted line" }] },
              { text: ", and its end." },
            ],
          },
        ])}
      />
    </div>
  ),
  play: async () => {
    const frame = screen.getByTestId("frame");
    const markdown = within(frame).getByText(/^Two editions:/);

    await expect(markdown.querySelectorAll("br")).toHaveLength(2);
    await expect(markdown).toHaveTextContent(
      "Two editions:- *1965*, cloth- 1971, paper",
    );
    await expect(frame.querySelector("em, strong, li")).toBeNull();
    await expect(
      within(frame).getByText("A quoted line, and its end."),
    ).toBeVisible();
    await expect(within(frame).getByText("Before the quote.")).toBeVisible();
  },
};

/**
 * The words a search matched, highlighted, in a value that `markedParagraph`
 * builds from a search excerpt. The play test checks that a match inside a URL
 * is highlighted inside the link, and that the link goes to the whole URL.
 */
export const Highlighted: Story = {
  args: {
    value: markedParagraph(
      "[[Burton]], Isabel. Scan at https://archive.org/details/[[iracema]]00alen.",
    ),
  },
  play: async ({ canvasElement }) => {
    const marks = canvasElement.querySelectorAll("mark");
    const link = screen.getByRole("link");

    await expect([...marks].map((mark) => mark.textContent)).toEqual([
      "Burton",
      "iracema",
    ]);
    await expect(link).toHaveAttribute(
      "href",
      "https://archive.org/details/iracema00alen",
    );
    await expect(link).toContainElement(marks[1]);
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
