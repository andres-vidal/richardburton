import type { Meta, StoryObj } from "@storybook/react";
import { ComponentProps, FC, useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import TextEnumDataInput from "./TextEnumDataInput";

// The selected code is a controlled prop: hold it in state so a picked country
// sticks in the input instead of vanishing when the menu closes.
const Controlled: FC<ComponentProps<typeof TextEnumDataInput>> = ({
  value: initial,
  onChange,
  ...props
}) => {
  const [value, setValue] = useState(initial);
  return (
    <TextEnumDataInput
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

// A single-select Select backed by autocomplete. Driven here with `countries`,
// whose options resolve locally (no network). `value` is one country code and
// shows in the input via its country name (Publication.describeValue).
const meta = {
  title: "Publications/Text enum data input",
  component: TextEnumDataInput,
  args: {
    rowId: 1,
    colId: "countries",
    value: "",
    error: "",
    onChange: fn(),
    "aria-label": "Country",
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
} satisfies Meta<typeof TextEnumDataInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Empty select — a combobox textbox with its dropdown toggle. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("combobox"),
    ).toBeInTheDocument();
  },
};

/** A selected country code shows as its country name in the input. */
export const WithValue: Story = {
  args: { value: "US" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox")).toHaveValue(
      "United States of America",
    );
  },
};

/** Typing filters the local country options; Enter commits the highlighted one
 * and its name sticks in the input. */
export const SelectsOption: Story = {
  // Floating-ui's focus guards (tabindex=0 + aria-hidden) are a deliberate
  // pattern that axe's aria-hidden-focus rule over-reports on open menus.
  parameters: {
    a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } },
  },
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox");
    await userEvent.type(input, "braz");

    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Brazil" })).toBeInTheDocument(),
    );
    await userEvent.keyboard("{Enter}");

    await expect(args.onChange).toHaveBeenCalledWith("BR");
    // The search reset cascades over a couple of renders after the menu closes.
    await waitFor(() => expect(input).toHaveValue("Brazil"));
  },
};

/** Error state — the input is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { error: "is required" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};
