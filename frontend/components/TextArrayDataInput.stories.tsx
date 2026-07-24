import type { Meta, StoryObj } from "@storybook/react";
import { ComponentProps, FC, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import TextArrayDataInput from "./TextArrayDataInput";

// The comma-separated `value` is controlled: hold it in state so pill
// add/remove sticks on screen.
const Controlled: FC<ComponentProps<typeof TextArrayDataInput>> = ({
  value: initial,
  onChange,
  ...props
}) => {
  const [value, setValue] = useState(initial);
  return (
    <TextArrayDataInput
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

// A Multicombobox for free-text list cells (authors, originalAuthors,
// publishers). The comma-separated `value` renders as removable pills. Its
// autocomplete calls the network on keystroke, so these stories never type
// into the field — but pill removal is purely local and live.
const meta = {
  title: "Publications/Text array data input",
  component: TextArrayDataInput,
  args: {
    rowId: 1,
    colId: "authors",
    value: "",
    error: "",
    onChange: fn(),
    "aria-label": "Authors",
  },
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center w-72 aspect-square overflow-auto rounded-lg border border-dashed border-gray-300 p-8 bg-stripes-diagonal">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof TextArrayDataInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Empty list cell — an autocomplete textbox with no pills yet. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("combobox"),
    ).toBeInTheDocument();
  },
};

/** A populated cell renders one removable pill per comma-separated value —
 * and removing one takes it off the screen. */
export const WithValues: Story = {
  args: { value: "Helen Caldwell,Benjamin Moser" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Helen Caldwell")).toBeInTheDocument();
    await expect(canvas.getByText("Benjamin Moser")).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Helen Caldwell" }),
    );
    await expect(canvas.queryByText("Helen Caldwell")).not.toBeInTheDocument();
    await expect(args.onChange).toHaveBeenCalledWith("Benjamin Moser");
  },
};

/** Error state — the cell input is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { error: "is required" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};
