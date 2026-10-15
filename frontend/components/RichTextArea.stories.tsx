import type { Meta, StoryObj } from "@storybook/react";
import { activeLink } from "modules/rich-text-editor";
import { ComponentProps, FC, useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { EVERY_FORMAT } from "test/rich-text-fixtures";
import { editorOf, editorSelected, focusEditor } from "test/slate";

import RichTextArea from "./RichTextArea";

/**
 * The field with its value held in state, as a form holds it, so an edit that
 * passes new Markdown to `onChange` also reaches `value`.
 */
const Controlled: FC<ComponentProps<typeof RichTextArea>> = ({
  value: initial,
  onChange,
  ...props
}) => {
  const [value, setValue] = useState(initial);

  return (
    <RichTextArea
      {...props}
      value={value}
      onChange={(markdown) => {
        setValue(markdown);
        onChange(markdown);
      }}
    />
  );
};

/** How long `Late` takes to pass each value back, in milliseconds. */
const LATENESS = 30;

/**
 * The field with its value held in state that takes each new value `LATENESS`
 * milliseconds after `onChange` passes it, as a parent that renders behind the
 * typing does.
 */
const Late: FC<ComponentProps<typeof RichTextArea>> = ({
  value: initial,
  onChange,
  ...props
}) => {
  const [value, setValue] = useState(initial);

  return (
    <RichTextArea
      {...props}
      value={value}
      onChange={(markdown) => {
        setTimeout(() => setValue(markdown), LATENESS);
        onChange(markdown);
      }}
    />
  );
};

const meta = {
  title: "Components/Rich text area",
  component: RichTextArea,
  args: {
    label: "Description",
    hint: "Shown under the title.",
    placeholder: "A few lines about it",
    value: null,
    onChange: fn(),
  },
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="p-6 w-lg max-w-full bg-white rounded-lg border border-gray-200">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof RichTextArea>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Returns the field's text area. */
const textbox = () => screen.getByRole("textbox", { name: "Description" });

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

/** Returns the Markdown the field last passed to `onChange`. */
const lastMarkdown = (onChange: unknown) =>
  (onChange as ReturnType<typeof fn>).mock.lastCall?.[0];

/**
 * An empty field: the label and the hint, which describes the text area, over
 * the toolbar and the placeholder. Typing passes the text to `onChange` as
 * Markdown.
 */
export const Empty: Story = {
  play: async ({ args }) => {
    await expect(textbox()).toHaveAttribute("aria-multiline", "true");
    await expect(textbox()).toHaveAccessibleDescription(
      "Shown under the title.",
    );
    await expect(screen.getByText("A few lines about it")).toBeInTheDocument();

    await focusEditor(textbox());
    await userEvent.keyboard("A first line.");

    await waitFor(() =>
      expect(lastMarkdown(args.onChange)).toBe("A first line."),
    );
  },
};

/**
 * The empty text area is at least 10rem tall. Its placeholder starts where the
 * caret does, inside the text area's padding or after the marker of an empty
 * list item, and wraps inside the text area, which does not scroll sideways.
 * The play test measures once the text area has focus.
 */
export const EmptyLayout: Story = {
  args: {
    placeholder:
      "A placeholder long enough to wrap onto a second line, which stays inside the text area",
  },
  play: async () => {
    const area = textbox();
    const placeholder = () =>
      area.querySelector<HTMLElement>("[data-slate-placeholder]");
    const layout = () => {
      const outer = area.getBoundingClientRect();
      const inner = placeholder()!.getBoundingClientRect();

      return {
        top: inner.top - outer.top,
        left: inner.left - outer.left,
        right: outer.right - inner.right,
        tall: outer.height >= 160,
        scrolls: area.scrollWidth > area.clientWidth,
      };
    };

    await waitFor(() => expect(placeholder()).toBeVisible());
    await focusEditor(area);
    await waitFor(() =>
      expect(layout()).toEqual({
        top: 8,
        left: 12,
        right: 12,
        tall: true,
        scrolls: false,
      }),
    );

    await userEvent.click(tool("Bulleted list"));
    await waitFor(() =>
      expect(tool("Bulleted list")).toHaveAttribute("aria-pressed", "true"),
    );
    await waitFor(() =>
      expect(layout()).toEqual({
        top: 8,
        left: 36,
        right: 12,
        tall: true,
        scrolls: false,
      }),
    );
  },
};

/** A field with a label alone: no hint describes the text area. */
export const LabelOnly: Story = {
  args: { hint: undefined, placeholder: undefined },
  play: async () => {
    await expect(textbox()).toHaveAccessibleDescription("");
    await expect(textbox()).not.toHaveAttribute("aria-describedby");
  },
};

/**
 * Text that already uses every format: a paragraph with bold and italic text,
 * a line break and a link, and a numbered list nested in a bulleted one.
 */
export const WithContent: Story = {
  args: { value: EVERY_FORMAT },
  play: async ({ args }) => {
    await expect(
      within(textbox()).getByText("the guide").closest("a"),
    ).toHaveAttribute("href", "https://example.com/guide");
    await expect(
      within(textbox()).getByText("bold").closest("[data-bold]"),
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
    await focusEditor(textbox());
    await userEvent.keyboard("A ");

    await userEvent.click(tool("Bold"));
    await waitFor(() =>
      expect(tool("Bold")).toHaveAttribute("aria-pressed", "true"),
    );
    await editorSelected(textbox());
    await userEvent.keyboard("bold");
    await userEvent.click(tool("Bold"));
    await waitFor(() =>
      expect(tool("Bold")).toHaveAttribute("aria-pressed", "false"),
    );
    await editorSelected(textbox());

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
    await focusEditor(textbox());
    await userEvent.click(tool("Bulleted list"));
    await waitFor(() =>
      expect(tool("Bulleted list")).toHaveAttribute("aria-pressed", "true"),
    );

    await userEvent.keyboard("Fruit{Enter}Apples");
    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("{Enter}{Enter}{Enter}After the list");

    await waitFor(() =>
      expect(lastMarkdown(args.onChange)).toBe(
        "- Fruit\n  - Apples\n\nAfter the list",
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
    await focusEditor(textbox());
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
    await userEvent.type(address, "example.com/guide");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Link text" }),
      "the guide",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Apply" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Link" })).toBeNull(),
    );
    await waitFor(() =>
      expect(lastMarkdown(args.onChange)).toBe(
        "See [the guide](https://example.com/guide)",
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
    await focusEditor(textbox());
    await userEvent.click(within(textbox()).getByText("the record"));
    await waitFor(() => expect(activeLink(editorOf(textbox()))).toBeTruthy());
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
 * test types the space only after the text area holds the whole URL, as it
 * would at a person's typing speed.
 */
export const TypingAUrl: Story = {
  play: async ({ args }) => {
    await focusEditor(textbox());
    await userEvent.keyboard("Read https://example.com/guide");
    await waitFor(() =>
      expect(textbox()).toHaveTextContent("Read https://example.com/guide"),
    );
    await userEvent.keyboard(" ");

    await waitFor(() =>
      expect(
        within(textbox()).getByText("https://example.com/guide").closest("a"),
      ).toHaveAttribute("href", "https://example.com/guide"),
    );
    await waitFor(() =>
      expect(lastMarkdown(args.onChange)).toBe(
        "Read <https://example.com/guide>",
      ),
    );
  },
};

/**
 * A parent that passes each value back late, after more has been typed. The
 * play test checks that the late values undo none of the typing, and that the
 * caret stays where the typing left it once every value has come back.
 */
export const ValueComingBackLate: Story = {
  render: (args) => <Late {...args} />,
  play: async ({ args }) => {
    await focusEditor(textbox());
    await userEvent.keyboard("Typed ahead of the parent");
    await waitFor(() =>
      expect(textbox()).toHaveTextContent("Typed ahead of the parent"),
    );
    await new Promise((resolve) => setTimeout(resolve, 2 * LATENESS));

    await userEvent.keyboard(".");

    await waitFor(() =>
      expect(lastMarkdown(args.onChange)).toBe("Typed ahead of the parent."),
    );
    await expect(textbox()).toHaveTextContent("Typed ahead of the parent.");
  },
};

/**
 * An error under the field. It describes the text area, after the hint, and
 * marks it invalid.
 */
export const WithError: Story = {
  args: { value: "Far too long…", error: "This text is too long" },
  play: async () => {
    await expect(textbox()).toHaveAttribute("aria-invalid", "true");
    await expect(textbox()).toHaveAccessibleDescription(
      /This text is too long/,
    );
  },
};
