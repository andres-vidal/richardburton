import type { Meta, StoryObj } from "@storybook/react";
import { FC, useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import CommentsEditor from "./CommentsEditor";

/**
 * The editor with its value held in state, as a form holds it, so an edit that
 * passes new Markdown to `onChange` also reaches `value`.
 */
const Controlled: FC<{
  value: string | null;
  onChange: (markdown: string) => void;
  error?: string;
}> = ({ value: initial, onChange, error }) => {
  const [value, setValue] = useState(initial);

  return (
    <CommentsEditor
      value={value}
      error={error}
      onChange={(markdown) => {
        setValue(markdown);
        onChange(markdown);
      }}
    />
  );
};

const meta = {
  title: "Publications/Comments editor",
  component: CommentsEditor,
  args: { value: null, onChange: fn() },
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="p-6 w-lg max-w-full bg-white rounded-lg border border-gray-200">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof CommentsEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Returns the editor's text area. */
const textbox = () => screen.getByRole("textbox", { name: "Comments" });

/** Returns the button of the formatting toolbar named `name`. */
const tool = (name: string) =>
  within(screen.getByRole("toolbar", { name: "Formatting" })).getByRole(
    "button",
    { name },
  );

/**
 * The key that `mod` names in a shortcut: Cmd on a Mac and Ctrl elsewhere, as
 * `is-hotkey` reads it.
 */
const MOD = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  ? "Meta"
  : "Control";

/** Returns the Markdown the editor last passed to `onChange`. */
const lastMarkdown = (onChange: unknown) =>
  (onChange as ReturnType<typeof fn>).mock.lastCall?.[0];

/**
 * Waits until the editor has focus, so that the keys typed next reach it. Slate
 * takes focus after a click or a toolbar command, not during it.
 */
const editorFocused = () => waitFor(() => expect(textbox()).toHaveFocus());

/**
 * An empty editor: the placeholder in the text area, under a labelled
 * toolbar. Typing passes the text to `onChange` as Markdown.
 */
export const Empty: Story = {
  play: async ({ args }) => {
    await expect(textbox()).toHaveAttribute("aria-multiline", "true");
    await expect(
      screen.getByText("Notes about this publication"),
    ).toBeInTheDocument();

    await userEvent.click(textbox());
    await editorFocused();
    await userEvent.keyboard("First edition, 1886.");

    await waitFor(() =>
      expect(lastMarkdown(args.onChange)).toBe("First edition, 1886."),
    );
  },
};

/**
 * Comments that already use every format: a paragraph with bold and italic
 * text and a link, and a list nested in a list.
 */
export const WithContent: Story = {
  args: {
    value:
      "Translated by **Isabel Burton**, *Lady Burton*. See [the 1886 edition](https://archive.org/details/iracema).\n\n- Reviews\n  1. *The Athenaeum*, 1886\n  2. *The Academy*, 1887\n- Reprints",
  },
  play: async ({ args }) => {
    await expect(
      within(textbox()).getByText("the 1886 edition").closest("a"),
    ).toHaveAttribute("href", "https://archive.org/details/iracema");
    await expect(
      within(textbox()).getByText("Isabel Burton").closest("[data-bold]"),
    ).toHaveAttribute("data-bold", "true");
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

/**
 * The Bold button, and Ctrl or Cmd with I, mark the text typed next. Each
 * button is pressed while its mark is on.
 */
export const TypingBoldAndItalic: Story = {
  play: async ({ args }) => {
    await userEvent.click(textbox());
    await editorFocused();
    await userEvent.keyboard("A ");

    await userEvent.click(tool("Bold"));
    await waitFor(() =>
      expect(tool("Bold")).toHaveAttribute("aria-pressed", "true"),
    );
    await editorFocused();
    await userEvent.keyboard("bold");
    await userEvent.click(tool("Bold"));
    await waitFor(() =>
      expect(tool("Bold")).toHaveAttribute("aria-pressed", "false"),
    );
    await editorFocused();

    await userEvent.keyboard(" and ");
    await userEvent.keyboard(`{${MOD}>}i{/${MOD}}`);
    await userEvent.keyboard("italic");
    await userEvent.keyboard(`{${MOD}>}i{/${MOD}}`);
    await userEvent.keyboard(" claim");

    await waitFor(() =>
      expect(lastMarkdown(args.onChange)).toBe("A **bold** and *italic* claim"),
    );
  },
};

/**
 * The Bulleted list button starts a list, Enter adds an item, Tab moves an
 * item a level deeper and Enter on an empty item leaves the list.
 */
export const MakingAList: Story = {
  play: async ({ args }) => {
    await userEvent.click(textbox());
    await editorFocused();
    await userEvent.click(tool("Bulleted list"));
    await waitFor(() =>
      expect(tool("Bulleted list")).toHaveAttribute("aria-pressed", "true"),
    );

    await userEvent.keyboard("Reviews{Enter}The Athenaeum");
    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("{Enter}{Enter}{Enter}After the list");

    await waitFor(() =>
      expect(lastMarkdown(args.onChange)).toBe(
        "- Reviews\n  - The Athenaeum\n\nAfter the list",
      ),
    );
    await waitFor(() =>
      expect(tool("Bulleted list")).toHaveAttribute("aria-pressed", "false"),
    );
  },
};

/**
 * The Link button opens a dialog for the address and the text of a new link.
 * An address that is not one is refused with a message, and Apply inserts the
 * link where the cursor was.
 */
export const AddingALink: Story = {
  play: async ({ args }) => {
    await userEvent.click(textbox());
    await editorFocused();
    await userEvent.keyboard("See ");
    await userEvent.click(tool("Link"));

    const dialog = await screen.findByRole("dialog", { name: "Link" });
    const address = within(dialog).getByRole("textbox", {
      name: "Link address",
    });
    await waitFor(() => expect(address).toHaveFocus());

    await userEvent.type(address, "not an address");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Apply" }),
    );
    await expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Enter a web address or an email address.",
    );

    await userEvent.clear(address);
    await userEvent.type(address, "archive.org/details/iracema");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Link text" }),
      "the scan",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Apply" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Link" })).toBeNull(),
    );
    await waitFor(() =>
      expect(lastMarkdown(args.onChange)).toBe(
        "See [the scan](https://archive.org/details/iracema)",
      ),
    );
  },
};

/**
 * Ctrl or Cmd with K opens the link dialog on the link the cursor is in, with
 * its address, and Remove link turns it back into text. Escape closes the
 * dialog and changes nothing.
 */
export const EditingALink: Story = {
  args: { value: "Read [the record](https://example.com/record) first." },
  play: async ({ args }) => {
    await userEvent.click(within(textbox()).getByText("the record"));
    await userEvent.keyboard(`{${MOD}>}k{/${MOD}}`);

    const dialog = await screen.findByRole("dialog", { name: "Link" });
    await expect(
      within(dialog).getByRole("textbox", { name: "Link address" }),
    ).toHaveValue("https://example.com/record");
    await expect(
      within(dialog).queryByRole("textbox", { name: "Link text" }),
    ).toBeNull();

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Link" })).toBeNull(),
    );
    await expect(args.onChange).not.toHaveBeenCalled();

    await userEvent.click(tool("Link"));
    await userEvent.click(
      await screen.findByRole("button", { name: "Remove link" }),
    );
    await waitFor(() =>
      expect(lastMarkdown(args.onChange)).toBe("Read the record first."),
    );
  },
};

/**
 * A URL typed into the text becomes a link once a space follows it. The play
 * test types the space only after the editor holds the whole URL, as it would
 * at a person's typing speed.
 */
export const TypingAUrl: Story = {
  play: async ({ args }) => {
    await userEvent.click(textbox());
    await editorFocused();
    await userEvent.keyboard("Scanned at https://archive.org/details/iracema");
    await waitFor(() =>
      expect(textbox()).toHaveTextContent(
        "Scanned at https://archive.org/details/iracema",
      ),
    );
    await userEvent.keyboard(" ");

    await waitFor(() =>
      expect(
        within(textbox())
          .getByText("https://archive.org/details/iracema")
          .closest("a"),
      ).toHaveAttribute("href", "https://archive.org/details/iracema"),
    );
    await waitFor(() =>
      expect(lastMarkdown(args.onChange)).toBe(
        "Scanned at <https://archive.org/details/iracema>",
      ),
    );
  },
};

/** An error from the server's validation, under the editor. */
export const WithError: Story = {
  args: { value: "Far too long…", error: "This text is too long" },
  play: async () => {
    await expect(textbox()).toHaveAttribute("aria-invalid", "true");
    await expect(textbox()).toHaveAccessibleDescription(
      /This text is too long/,
    );
  },
};
