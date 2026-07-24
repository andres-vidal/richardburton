import type { Meta, StoryObj } from "@storybook/react";
import { ComponentProps, FC, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import TextEnumArrayDataInput from "./TextEnumArrayDataInput";

// The comma-separated codes are controlled: hold them in state so pill
// add/remove sticks on screen.
const Controlled: FC<ComponentProps<typeof TextEnumArrayDataInput>> = ({
  value: initial,
  onChange,
  ...props
}) => {
  const [value, setValue] = useState(initial);
  return (
    <TextEnumArrayDataInput
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

// A Multicombobox for the `countries` cell. The comma-separated `value` holds
// ISO country codes; each renders as a pill labelled by its country name (via
// Publication.describeValue). Country autocomplete resolves locally, but these
// stories avoid depending on the dropdown — pill removal is local and live.
const meta = {
  title: "Publications/Text enum array data input",
  component: TextEnumArrayDataInput,
  args: {
    rowId: 1,
    colId: "countries",
    value: "",
    error: "",
    onChange: fn(),
    "aria-label": "Countries",
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
} satisfies Meta<typeof TextEnumArrayDataInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Empty cell — an autocomplete textbox with no country pills yet. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("combobox"),
    ).toBeInTheDocument();
  },
};

/** A selected country code renders as a pill labelled by its country name —
 * and removing it takes it off the screen. */
export const WithValues: Story = {
  args: { value: "US" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("United States of America"),
    ).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole("button", { name: "Remove United States of America" }),
    );
    await expect(
      canvas.queryByText("United States of America"),
    ).not.toBeInTheDocument();
    await expect(args.onChange).toHaveBeenCalledWith("");
  },
};

/** Error state — the cell input is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { error: "should be a valid country code" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};
