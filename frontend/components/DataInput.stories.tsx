import type { Meta, StoryObj } from "@storybook/react";
import { store } from "modules/store";
import { seed } from "modules/publication/fixtures";
import { ComponentProps, FC, useState } from "react";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import DataInput from "./DataInput";

// The dispatcher's `value` is a controlled prop (the app closes the loop via
// usePublicationField): hold it in state so edits show on screen here too.
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

// The cell-editor dispatcher: picks the right Text*DataInput by the column's
// attribute type and wires edits back into the publication store.
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

/** A text column renders a plain, editable text cell. */
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

/** A numeric column (year) renders the number cell (a styled text input). */
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
 * An error marks the cell invalid (`aria-invalid`). In the workspace table the
 * message itself lives in a tooltip — a message under a cell would reflow the
 * grid — so the tinted cell is the signal and hovering gives the detail.
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
    // Not written out beside the field in this mode.
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

/**
 * `errorDisplay="inline"` writes the message under the field instead. The edit
 * form uses this: it has the room, and an error nobody hovers is an error
 * nobody reads.
 */
export const InlineError: Story = {
  beforeEach: () => seed(store),
  args: {
    colId: "title",
    value: "",
    error: "is required",
    bordered: true,
    errorDisplay: "inline",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const message = canvas.getByRole("alert");
    await expect(message).toHaveTextContent("is required");
    // Below the field, not floating over it.
    await expect(
      canvas.getByRole("textbox").getBoundingClientRect().bottom,
    ).toBeLessThanOrEqual(message.getBoundingClientRect().top + 1);
  },
};

/**
 * A picked option validates at once, without waiting for blur. Countries is the
 * only `enumArray` column, and a combobox keeps focus after a selection — so
 * validating on blur alone left the row looking valid until some *other* field
 * was touched.
 */
export const ValidatesOnSelection: Story = {
  beforeEach: () => seed(store),
  args: {
    colId: "countries",
    value: "",
    autoValidated: true,
    onValidate: fn(),
    bordered: true,
  },
  play: async ({ args, canvasElement }) => {
    // Typing is what opens the menu — it runs the option lookup behind it.
    // `screen`, not the canvas: the menu is portalled outside the story.
    const input = within(canvasElement).getByRole("combobox");
    await userEvent.type(input, "Brazil");
    await userEvent.click(
      await screen.findByRole("option", { name: "Brazil" }),
    );

    // The selection alone is enough — nothing else has been touched, and the
    // combobox still holds focus, so no blur has happened.
    await expect(args.onValidate).toHaveBeenCalled();
  },
};

/**
 * The reserved message slot keeps the field's height constant, so an error
 * appearing cannot shove the fields below it — or, in the edit form's
 * two-column grid, its neighbour.
 */
export const ErrorDoesNotShiftLayout: Story = {
  beforeEach: () => seed(store),
  args: {
    colId: "title",
    value: "",
    error: "",
    bordered: true,
    errorDisplay: "inline",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("alert").parentElement!;

    const quiet = field.offsetHeight;
    // Every message the model can produce is one line at a form's width.
    canvas.getByRole("alert").textContent =
      "A publication with this data already exists";

    await expect(field.offsetHeight).toBe(quiet);
  },
};

/**
 * `bordered` — the outlined variant used by the edit form. The dispatcher
 * forwards it to the underlying input, which draws a visible box.
 */
export const Bordered: Story = {
  beforeEach: () => seed(store),
  args: { colId: "title", value: "Dom Casmurro", bordered: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    const box = input.closest("[data-bordered='true']")!;
    await expect(getComputedStyle(box).borderTopWidth).toBe("1px");
  },
};
