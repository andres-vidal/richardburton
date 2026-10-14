import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, within } from "storybook/test";

import Comments from "./Comments";

const meta = {
  title: "Publications/Comments",
  component: Comments,
  decorators: [
    (Story) => (
      <div className="p-6 w-lg max-w-full bg-white" data-testid="frame">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof Comments>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Comments with every format they support: paragraphs, a line break, bold and
 * italic text, a bulleted list with a numbered list nested in it, and a link,
 * which opens in a new tab and passes on neither the page nor its address.
 */
export const Default: Story = {
  args: {
    markdown:
      "Translated by **Isabel Burton**, *Lady Burton*, from the 1865 text.\\\nPublished after her husband's death.\n\n- Reviews\n  1. *The Athenaeum*, 1886\n  2. *The Academy*, 1887\n- A scan at [the Internet Archive](https://archive.org/details/iracema)",
  },
  play: async () => {
    const link = screen.getByRole("link", { name: "the Internet Archive" });

    await expect(link).toHaveAttribute(
      "href",
      "https://archive.org/details/iracema",
    );
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");

    await expect(screen.getByText("Isabel Burton").tagName).toBe("STRONG");
    await expect(screen.getAllByRole("list")).toHaveLength(2);
    await expect(
      within(screen.getAllByRole("list")[1]).getAllByRole("listitem"),
    ).toHaveLength(2);
  },
};

/** A bare URL and an email address read as links. */
export const BareLinks: Story = {
  args: {
    markdown:
      "Scanned at https://archive.org/details/iracema, ask ed@example.org.",
  },
  play: async () => {
    await expect(
      screen.getByRole("link", { name: "https://archive.org/details/iracema" }),
    ).toHaveAttribute("href", "https://archive.org/details/iracema");
    await expect(
      screen.getByRole("link", { name: "ed@example.org" }),
    ).toHaveAttribute("href", "mailto:ed@example.org");
  },
};

/**
 * Markdown that comments do not support keeps its text: raw HTML reads as
 * text rather than markup, a heading is a paragraph, and a link to anything
 * but a web or email address is its label alone.
 */
export const UnsupportedMarkdown: Story = {
  args: {
    markdown:
      "# A heading\n\n<img src=x onerror=alert(1)> and <b>tags</b>\n\n[a script](javascript:alert(1)) and ![a cover](https://example.com/c.png)",
  },
  play: async () => {
    const frame = screen.getByTestId("frame");

    await expect(
      within(frame).getByText("<img src=x onerror=alert(1)> and <b>tags</b>"),
    ).toBeInTheDocument();
    await expect(frame.querySelector("img, b, h1, script")).toBeNull();
    await expect(within(frame).queryByRole("link")).toBeNull();
    await expect(within(frame).getByText("a script and a cover")).toBeVisible();
  },
};

/** The smaller text, for a dense place such as the history. */
export const Small: Story = {
  args: {
    markdown: "First edition. **Out of print.**\n\n- one copy\n- *two* copies",
    size: "small",
  },
};

/** Empty comments render nothing. */
export const Empty: Story = {
  args: { markdown: null },
  play: async () => {
    await expect(screen.getByTestId("frame")).toBeEmptyDOMElement();
  },
};
