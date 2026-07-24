import type { Meta, StoryObj } from "@storybook/react";
import { seed } from "modules/publication/fixtures";
import { ComponentProps, FC, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

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
  beforeEach: () => seed(),
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
  beforeEach: () => seed(),
  args: { colId: "year", value: "1953" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveValue(
      "1953",
    );
  },
};

/** An error marks the cell invalid (`aria-invalid`). */
export const WithError: Story = {
  beforeEach: () => seed(),
  args: { colId: "title", value: "", error: "is required" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};

/**
 * `bordered` — the outlined variant used by the edit form. The dispatcher
 * forwards it to the underlying input, which draws a visible box.
 */
export const Bordered: Story = {
  beforeEach: () => seed(),
  args: { colId: "title", value: "Dom Casmurro", bordered: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    const box = input.closest("[data-bordered='true']")!;
    await expect(getComputedStyle(box).borderTopWidth).toBe("1px");
  },
};
