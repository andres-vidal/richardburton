import type { Meta, StoryObj } from "@storybook/react";
import { ComponentProps, FC, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import TextNumberDataInput from "./TextNumberDataInput";

// The cell is controlled: hold the stored string in state so typing and the
// ▲/▼ buttons visibly move the value (its base NumberInput.stories does the same).
const Controlled: FC<ComponentProps<typeof TextNumberDataInput>> = ({
  value: initial,
  onChange,
  ...props
}) => {
  const [value, setValue] = useState(initial);
  return (
    <TextNumberDataInput
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

// Wraps NumberInput for the `year` cell. `value` is the stored string; typing a
// digit parses it and `onChange` re-emits it as a string. Props are passed
// directly, so no store seeding is needed.
const meta = {
  title: "Publications/Text number data input",
  component: TextNumberDataInput,
  args: {
    rowId: 1,
    colId: "year",
    value: "",
    error: "",
    onChange: fn(),
    "aria-label": "Year",
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
} satisfies Meta<typeof TextNumberDataInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Empty numeric cell — typing a digit shows it and emits it as a string. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    await expect(input).toBeInTheDocument();

    await userEvent.type(input, "7");
    await expect(input).toHaveValue("7");
    await expect(args.onChange).toHaveBeenCalledWith("7");
  },
};

/** Cell pre-filled with a year. */
export const WithValue: Story = {
  args: { value: "1953" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveValue(
      "1953",
    );
  },
};

/** Error state — the cell input is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { error: "should be an integer" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};
