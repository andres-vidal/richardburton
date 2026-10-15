import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { seed } from "test/publication-fixtures";
import { ComponentProps, FC, useState } from "react";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import DataInput from "./DataInput";

// The field's `value` is a controlled prop, which the app reads back from the
// store with `usePublicationField`. This wrapper holds it in state instead, so
// edits show on screen.
const Controlled: FC<ComponentProps<typeof DataInput>> = ({
  value: initial,
  onChange,
  ...props
}) => {
  const [value, setValue] = useState(initial);
  return (
    <DataInput
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

const meta = {
  title: "Publications/Data input",
  component: DataInput,
  args: { rowId: 1, colId: "title", value: "", error: "", onChange: fn() },
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center w-72 aspect-square overflow-auto rounded-lg border border-dashed border-gray-300 p-8 bg-stripes-diagonal">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof DataInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A text column renders a text field, and typing edits it. */
export const Default: Story = {
  beforeEach: () => seed(store),
  args: { colId: "title", value: "Dom Casmurro" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    await expect(input).toHaveValue("Dom Casmurro");

    await userEvent.type(input, "!");
    await expect(input).toHaveValue("Dom Casmurro!");
  },
};

/** A number column, the year, renders the number field. */
export const Number: Story = {
  beforeEach: () => seed(store),
  args: { colId: "year", value: "1953" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveValue(
      "1953",
    );
  },
};

/**
 * An error marks the field invalid (`aria-invalid`) and puts the message in a
 * tooltip. The play test checks that no message is written beside the field.
 */
export const WithError: Story = {
  beforeEach: () => seed(store),
  args: { colId: "title", value: "", error: "is required" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("textbox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

/**
 * `errorDisplay="inline"` writes the message under the field. The play test
 * checks that the message is below the field and not over it.
 */
export const InlineError: Story = {
  beforeEach: () => seed(store),
  args: {
    colId: "title",
    value: "",
    error: "is required",
    errorDisplay: "inline",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const message = canvas.getByRole("alert");
    await expect(message).toHaveTextContent("is required");
    await expect(
      canvas.getByRole("textbox").getBoundingClientRect().bottom,
    ).toBeLessThanOrEqual(message.getBoundingClientRect().top + 1);
  },
};

/**
 * Picking an option is an edit like a keystroke. The play test picks a country
 * and checks that `onChange` received it while the combobox still has focus.
 */
export const WritesOnSelection: Story = {
  beforeEach: () => seed(store),
  args: {
    colId: "countries",
    value: [],
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    // Typing runs the lookup that opens the menu. The menu is rendered in a
    // portal outside the story, so it is found through `screen`.
    const input = within(canvasElement).getByRole("combobox");
    await userEvent.type(input, "Brazil");
    await userEvent.click(
      await screen.findByRole("option", { name: "Brazil" }),
    );

    await expect(input).toHaveFocus();
    await expect(args.onChange).toHaveBeenCalled();
  },
};

/**
 * The inline message slot is reserved, so the field is as tall with a message
 * as without one. The play test writes the longest message the model produces
 * into the slot and compares the heights.
 */
export const ErrorDoesNotShiftLayout: Story = {
  beforeEach: () => seed(store),
  args: {
    colId: "title",
    value: "",
    error: "",
    errorDisplay: "inline",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("alert").parentElement!;

    const quiet = field.offsetHeight;
    canvas.getByRole("alert").textContent =
      "A publication with this data already exists";

    await expect(field.offsetHeight).toBe(quiet);
  },
};

/** The field always draws its input as an outlined box. */
export const Bordered: Story = {
  beforeEach: () => seed(store),
  args: { colId: "title", value: "Dom Casmurro" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    const box = input.closest("[data-bordered='true']")!;
    await expect(getComputedStyle(box).borderTopWidth).toBe("1px");
  },
};
