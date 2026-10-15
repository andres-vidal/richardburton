import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, within } from "storybook/test";
import {
  BARE_LINKS,
  EVERY_FORMAT,
  UNSUPPORTED_MARKDOWN,
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
  args: { markdown: EVERY_FORMAT },
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

/** A bare URL and an email address read as links. */
export const BareLinks: Story = {
  args: { markdown: BARE_LINKS },
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
 * Markdown that rich text does not support keeps its text: raw HTML reads as
 * text rather than markup, a heading is a paragraph, and a link to anything
 * but a web or email address is its label alone.
 */
export const UnsupportedMarkdown: Story = {
  args: { markdown: UNSUPPORTED_MARKDOWN },
  play: async () => {
    const frame = screen.getByTestId("frame");

    await expect(
      within(frame).getByText("<img src=x onerror=alert(1)> and <b>tags</b>"),
    ).toBeInTheDocument();
    await expect(frame.querySelector("img, b, h1, script")).toBeNull();
    await expect(within(frame).queryByRole("link")).toBeNull();
    await expect(
      within(frame).getByText("a script and a picture"),
    ).toBeVisible();
  },
};

/** The smaller text, with less space between blocks. */
export const Small: Story = {
  args: {
    markdown: "A short note. **Read it twice.**\n\n- one copy\n- *two* copies",
    size: "small",
  },
};

/** Empty Markdown renders nothing. */
export const Empty: Story = {
  args: { markdown: null },
  play: async () => {
    await expect(screen.getByTestId("frame")).toBeEmptyDOMElement();
  },
};
