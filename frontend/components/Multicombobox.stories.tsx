import type { Meta, StoryObj } from "@storybook/react";
import { FC, useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import Multicombobox from "./Multicombobox";

const OPTIONS = ["Fiction", "Poetry", "Essay", "Drama"];

const onSubmit = fn();

type Enum = { id: string; label: string };

const COUNTRIES: Enum[] = [
  { id: "GB", label: "United Kingdom" },
  { id: "US", label: "United States of America" },
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

// Multicombobox is controlled: `value` lives in the parent. This wrapper holds
// it in state so pills actually add/remove as you interact, while still
// forwarding every change to the `onChange` spy for assertions.
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
    />
  );
};

const meta = {
  title: "Components/Multicombobox",
  component: Multicombobox,
  tags: ["autodocs"],
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
 * A single walkthrough of the whole component: type + Enter to add pills, an
 * async lookup on keystroke, and Backspace on an empty input to remove the last
 * pill.
 */
export const Default: Story = {
  // With the dropdown open, floating-ui inserts focus guards (tabindex=0 +
  // aria-hidden) to trap focus — a deliberate pattern axe's aria-hidden-focus
  // rule over-reports, so disable it for this open-menu story.
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
 * `bordered` — the outlined variant used in forms (e.g. the edit modal). The
 * dropdown adopts the matching outlined style (white, bordered, `text-sm`)
 * rather than the subtle dense style of the workspace table.
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
 * The same value can't be added twice: `select` guards on `!value.includes(item)`,
 * so re-entering an existing value is a no-op — no duplicate pill, no extra
 * `onChange`.
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

    // Padding doesn't smuggle a duplicate through: the server trims before
    // storing, so the comparison trims too — otherwise the record would be
    // rejected on save for repeating an entry.
    await userEvent.type(input, "  Fiction  {Enter}");
    await expect(canvas.getAllByText("Fiction")).toHaveLength(1);
    await expect(args.onChange).toHaveBeenLastCalledWith(["Fiction"]);
  },
};

/**
 * Inside a form — the edit modal's context. Committing an entry with Enter
 * must not submit the surrounding form: the keystroke belongs to the field.
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
    await userEvent.type(input, "dr{Enter}");
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
 * Object items — the shape the Countries field uses. Each lookup builds fresh
 * objects, so identity has to come from `id`; reference equality would let the
 * same country in twice.
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

/**
 * Positioning (the `size` middleware in MenuProvider): the dropdown is pinned to
 * the trigger's width. Verified by geometry (getBoundingClientRect), not pixels.
 */
export const MenuMatchesTriggerWidth: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");

    await userEvent.type(input, "e");
    const listbox = await screen.findByRole("listbox");

    // The reference floating-ui measures is the input's wrapper (TextInput's
    // root), and `size` sets the menu width to it.
    const reference = input.parentElement!.getBoundingClientRect();
    const menu = listbox.getBoundingClientRect();
    await expect(Math.round(menu.width)).toBe(Math.round(reference.width));
  },
};

/**
 * Arrow keys move the highlight through the options (MenuProvider's
 * `useListNavigation`), and Enter commits the highlighted one — here the second
 * match, not the auto-highlighted first. A floating-ui bump that broke list
 * navigation would surface here.
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

    // Move the highlight down to the second option, then commit it: Enter selects
    // the navigated-to option, not the one that was auto-highlighted on typing.
    await userEvent.keyboard("{ArrowDown}{Enter}");

    await expect(args.onChange).toHaveBeenLastCalledWith(["Essay"]);
    await expect(canvas.getByText("Essay")).toBeInTheDocument();
  },
};
