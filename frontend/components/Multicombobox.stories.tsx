import type { Meta, StoryObj } from "@storybook/react";
import { FC, useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { TYPING_DELAY_MS } from "utils/useLookup";

import Multicombobox from "./Multicombobox";

const OPTIONS = ["Fiction", "Poetry", "Essay", "Drama"];

const onSubmit = fn();

type Enum = { id: string; label: string };

const COUNTRIES: Enum[] = [
  { id: "GB", label: "United Kingdom" },
  { id: "US", label: "United States" },
  { id: "BR", label: "Brazil" },
];

const onEnumChange = fn();

const ControlledEnum: FC<{ onChange: (value: Enum[]) => void }> = ({
  onChange,
}) => {
  const [value, setValue] = useState<Enum[]>([]);

  return (
    <Multicombobox<Enum>
      value={value}
      placeholder="Add a country"
      getOptions={(search) =>
        COUNTRIES.filter((c) => c.label.toLowerCase().includes(search)).map(
          (c) => ({ ...c }),
        )
      }
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
};

// Multicombobox is controlled. This wrapper holds `value` in state, so chips
// are added and removed on screen, and passes every change on to the
// `onChange` spy. The field accepts typed text, like the fields for names.
const Controlled: FC<{
  value?: string[];
  error?: string;
  bordered?: boolean;
  getOptions: (search: string) => Promise<string[]> | string[];
  onChange: (value: string[]) => void;
}> = ({ value: initial = [], error, bordered, getOptions, onChange }) => {
  const [value, setValue] = useState(initial);

  return (
    <Multicombobox<string>
      value={value}
      error={error}
      bordered={bordered}
      placeholder="Add a genre"
      getOptions={getOptions}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      freeText
    />
  );
};

const meta = {
  title: "Components/Multicombobox",
  component: Multicombobox,
  args: {
    value: [],
    onChange: fn(),
    getOptions: fn(async (search: string) =>
      OPTIONS.filter((o) => o.toLowerCase().includes(search)),
    ),
    placeholder: "Add a genre",
  },
  render: (args) => (
    <Controlled
      value={args.value}
      error={args.error}
      bordered={args.bordered}
      getOptions={args.getOptions}
      onChange={args.onChange}
    />
  ),
  parameters: { layout: "centered" },
} satisfies Meta<typeof Multicombobox<string>>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Typing and Enter add a chip, and Backspace in the empty field removes the
 * last one. The play test also checks that typing runs the lookup.
 */
export const Default: Story = {
  // The open menu adds focus guards that are focusable and aria-hidden, which
  // axe's aria-hidden-focus rule reports, so the rule is off for this story.
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");

    // Starts empty.
    await expect(canvas.queryByText("Fiction")).not.toBeInTheDocument();

    // Type + Enter adds a pill.
    await userEvent.type(input, "Fiction{Enter}");
    await expect(canvas.getByText("Fiction")).toBeInTheDocument();
    await expect(args.onChange).toHaveBeenLastCalledWith(["Fiction"]);

    // ...and another.
    await userEvent.type(input, "Poetry{Enter}");
    await expect(canvas.getByText("Poetry")).toBeInTheDocument();
    await expect(args.onChange).toHaveBeenLastCalledWith(["Fiction", "Poetry"]);

    // Backspace on the (now empty) input removes the last pill.
    await userEvent.type(input, "{Backspace}");
    await expect(canvas.queryByText("Poetry")).not.toBeInTheDocument();
    await expect(canvas.getByText("Fiction")).toBeInTheDocument();
    await expect(args.onChange).toHaveBeenLastCalledWith(["Fiction"]);

    // Typing runs the async option lookup that backs the floating menu.
    await userEvent.type(input, "dr");
    await waitFor(() => expect(args.getOptions).toHaveBeenCalledWith("dr"));
  },
};

/**
 * `bordered` outlines the field for a form, and its menu matches it. The play
 * test checks the menu's border and text size.
 */
export const Bordered: Story = {
  args: { bordered: true, value: ["Fiction"] },
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");
    await userEvent.type(input, "e");
    const listbox = await screen.findByRole("listbox");
    // Outlined dropdown: a visible border and the larger text-sm size, unlike
    // the borderless text-xs subtle menu.
    await expect(getComputedStyle(listbox).borderTopWidth).toBe("1px");
    await expect(getComputedStyle(listbox).fontSize).toBe("14px");
  },
};

/** Error state — the field is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { error: "is required" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};

/**
 * An entry that is already chosen is not added again, even with spaces around
 * it. The play test enters "Fiction" three times and checks for one chip.
 */
export const DuplicateFilter: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");

    await userEvent.type(input, "Fiction{Enter}");
    await expect(canvas.getAllByText("Fiction")).toHaveLength(1);
    await expect(args.onChange).toHaveBeenLastCalledWith(["Fiction"]);

    // Re-adding "Fiction" changes nothing: still one pill, and the last onChange
    // is still the single-item array (never ["Fiction", "Fiction"]).
    await userEvent.type(input, "Fiction{Enter}");
    await expect(canvas.getAllByText("Fiction")).toHaveLength(1);
    await expect(args.onChange).toHaveBeenLastCalledWith(["Fiction"]);

    // The comparison trims the text, as the server does before storing it.
    await userEvent.type(input, "  Fiction  {Enter}");
    await expect(canvas.getAllByText("Fiction")).toHaveLength(1);
    await expect(args.onChange).toHaveBeenLastCalledWith(["Fiction"]);
  },
};

/**
 * Inside a form, Enter that adds an entry does not submit the form. The play
 * test checks typed text, a highlighted option and a click, and then checks
 * that Enter in the empty field submits.
 */
export const InsideAForm: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  beforeEach: () => {
    onSubmit.mockClear();
  },
  render: (args) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Controlled
        value={args.value}
        getOptions={args.getOptions}
        onChange={args.onChange}
      />
      <button type="submit">Save</button>
    </form>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");

    // Enter commits the typed entry...
    await userEvent.type(input, "Fiction{Enter}");
    await expect(canvas.getByText("Fiction")).toBeInTheDocument();
    // ...and the form stays put.
    await expect(onSubmit).not.toHaveBeenCalled();

    // Enter picks the highlighted option without submitting either.
    await userEvent.type(input, "dr");
    await screen.findByRole("option", { name: "Drama" });
    await userEvent.keyboard("{Enter}");
    await expect(args.onChange).toHaveBeenLastCalledWith(["Fiction", "Drama"]);
    await expect(onSubmit).not.toHaveBeenCalled();

    // Clicking an option behaves the same.
    await userEvent.type(input, "po");
    const listbox = await screen.findByRole("listbox");
    await userEvent.click(within(listbox).getByText("Poetry"));
    await expect(args.onChange).toHaveBeenLastCalledWith([
      "Fiction",
      "Drama",
      "Poetry",
    ]);
    await expect(onSubmit).not.toHaveBeenCalled();

    // With nothing typed, Enter is the form's again.
    await userEvent.type(input, "{Enter}");
    await expect(onSubmit).toHaveBeenCalled();
  },
};

/**
 * The input carries `aria-busy` from a keystroke until the options for what
 * was typed arrive.
 */
export const BusyWhileLookingUp: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");
    await expect(input).toHaveAttribute("aria-busy", "false");

    await userEvent.type(input, "dr");
    await expect(input).toHaveAttribute("aria-busy", "true");

    await screen.findByRole("option", { name: "Drama" });
    await expect(input).toHaveAttribute("aria-busy", "false");
  },
};

/**
 * Adding the typed text drops the lookup that is still pending for it, so no
 * menu opens over the emptied field when that lookup would have been answered.
 */
export const AnEntryDropsThePendingLookup: Story = {
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");

    await userEvent.type(input, "Drama{Enter}");
    await expect(args.onChange).toHaveBeenLastCalledWith(["Drama"]);
    await expect(input).toHaveAttribute("aria-busy", "false");

    await new Promise((resolve) => setTimeout(resolve, TYPING_DELAY_MS * 2));
    await expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  },
};

/**
 * Entries can be `{ id, label }` items, as countries are. Each lookup builds
 * new objects, so an item is matched by its `id`. The play test checks that a
 * chosen country is not offered again.
 */
export const ObjectItems: StoryObj = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  render: () => <ControlledEnum onChange={onEnumChange} />,
  beforeEach: () => {
    onEnumChange.mockClear();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");

    // Clicking an option selects it.
    await userEvent.type(input, "united");
    const listbox = await screen.findByRole("listbox");
    await userEvent.click(within(listbox).getByText("United Kingdom"));

    await expect(onEnumChange).toHaveBeenLastCalledWith([
      { id: "GB", label: "United Kingdom" },
    ]);
    await expect(canvas.getByText("United Kingdom")).toBeInTheDocument();
    await expect(input).toHaveValue("");

    // The same country cannot be added twice, even though the lookup returns
    // a brand-new object each time.
    await userEvent.type(input, "united");
    await waitFor(async () =>
      expect(
        within(await screen.findByRole("listbox")).queryByText(
          "United Kingdom",
        ),
      ).not.toBeInTheDocument(),
    );
  },
};

/** Clicking an option selects it, exactly as Enter and ArrowRight do. */
export const SelectsByClicking: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");

    await userEvent.type(input, "dr");
    const listbox = await screen.findByRole("listbox");
    await userEvent.click(within(listbox).getByText("Drama"));

    await expect(args.onChange).toHaveBeenLastCalledWith(["Drama"]);
    await expect(canvas.getByText("Drama")).toBeInTheDocument();
    // The search text is consumed, not left behind for the next entry.
    await expect(input).toHaveValue("");
  },
};

/**
 * A search with no matches says so, rather than opening an empty box. For a
 * free-text field the message also points out that the typed value can still
 * be added.
 */
export const NoMatches: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByRole("combobox"), "Sonnet");

    const listbox = await screen.findByRole("listbox");
    await expect(listbox).toHaveTextContent("No matches");

    // A listbox must contain an option, so the message is one — but a
    // disabled one: there is nothing here to choose.
    const options = within(listbox).getAllByRole("option");
    await expect(options).toHaveLength(1);
    await expect(options[0]).toHaveAttribute("aria-disabled", "true");
  },
};

/** The menu is as wide as the field. The play test compares the two widths. */
export const MenuMatchesTriggerWidth: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");

    await userEvent.type(input, "e");
    const listbox = await screen.findByRole("listbox");

    // The menu is measured against the field around the input.
    const source = input.parentElement!.getBoundingClientRect();
    const menu = listbox.getBoundingClientRect();
    await expect(Math.round(menu.width)).toBe(Math.round(source.width));
  },
};

/**
 * The arrow keys move the highlight through the options, and Enter adds the
 * highlighted one. The play test adds the second match.
 */
export const NavigatesOptionsWithArrowKeys: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");

    // "e" matches Poetry (index 0, auto-highlighted) and Essay (index 1).
    await userEvent.type(input, "e");
    await screen.findByRole("listbox");

    await userEvent.keyboard("{ArrowDown}{Enter}");

    await expect(args.onChange).toHaveBeenLastCalledWith(["Essay"]);
    await expect(canvas.getByText("Essay")).toBeInTheDocument();
  },
};

/**
 * A field is as tall empty as it is holding a chip, so a column of them does
 * not move as entries are added.
 */
export const AChipDoesNotChangeTheHeight: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");
    const field = input.parentElement!;

    const empty = field.getBoundingClientRect().height;

    await userEvent.type(input, "Fiction{Enter}");
    await expect(canvas.getByText("Fiction")).toBeInTheDocument();

    await expect(field.getBoundingClientRect().height).toBe(empty);
  },
};

/** The same holds for the outlined variant used in forms. */
export const AChipDoesNotChangeTheHeightWhenBordered: Story = {
  args: { bordered: true },
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");
    const field = input.parentElement!;

    const empty = field.getBoundingClientRect().height;

    await userEvent.type(input, "Fiction{Enter}");
    await expect(canvas.getByText("Fiction")).toBeInTheDocument();

    await expect(field.getBoundingClientRect().height).toBe(empty);
  },
};

/**
 * A comma adds the typed text and closes the menu. The play test checks that
 * no menu is left open over the empty field.
 */
export const ACommaClosesTheMenu: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");

    await userEvent.type(input, "dr");
    await screen.findByRole("option", { name: "Drama" });

    await userEvent.keyboard(",");

    await expect(args.onChange).toHaveBeenLastCalledWith(["dr"]);
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  },
};

/**
 * Without `freeText`, only an offered option can be added. The play test
 * presses a comma and Enter before the options arrive, and checks that neither
 * adds the typed text. Enter then adds the option once it is offered.
 */
export const OnlyOptionsWithoutFreeText: StoryObj = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  render: () => <ControlledEnum onChange={onEnumChange} />,
  beforeEach: () => {
    onEnumChange.mockClear();
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");

    await userEvent.type(input, "braz,{Enter}");
    await expect(onEnumChange).not.toHaveBeenCalled();
    await expect(input).toHaveValue("braz");

    await screen.findByRole("option", { name: "Brazil" });
    await userEvent.keyboard("{Enter}");

    await expect(onEnumChange).toHaveBeenLastCalledWith([
      { id: "BR", label: "Brazil" },
    ]);
  },
};
