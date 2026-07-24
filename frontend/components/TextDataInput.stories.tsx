import type { Meta, StoryObj } from "@storybook/react";
import { ComponentProps, FC, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import TextDataInput from "./TextDataInput";

// The cell is controlled: hold `value` in state so typing shows on screen.
const Controlled: FC<ComponentProps<typeof TextDataInput>> = ({
  value: initial,
  onChange,
  ...props
}) => {
  const [value, setValue] = useState(initial);
  return (
    <TextDataInput
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

// A thin pass-through to TextInput used for plain-text cells (title,
// originalTitle). It takes value/error/onChange directly, so the store isn't
// needed — pass the props straight in.
const meta = {
  title: "Publications/Text data input",
  component: TextDataInput,
  args: {
    rowId: 1,
    colId: "title",
    value: "",
    error: "",
    onChange: fn(),
    "aria-label": "Title",
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
} satisfies Meta<typeof TextDataInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Empty text cell — typing updates the value and emits it via `onChange`. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    await expect(input).toBeInTheDocument();

    await userEvent.type(input, "x");
    await expect(input).toHaveValue("x");
    await expect(args.onChange).toHaveBeenCalledWith("x");
  },
};

/** Cell pre-filled with a value. */
export const WithValue: Story = {
  args: { value: "Dom Casmurro" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveValue(
      "Dom Casmurro",
    );
  },
};

/** Error state — the cell input is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { error: "is required" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};
