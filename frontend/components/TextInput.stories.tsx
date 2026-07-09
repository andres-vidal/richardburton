import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";

import TextInput from "./TextInput";

const meta = {
  title: "Components/Text input",
  component: TextInput,
  tags: ["autodocs"],
  args: { value: "", onChange: fn(), "aria-label": "Title" },
  // The input is borderless + `bg-transparent` (it sits on a colored surface in
  // the app). Show it inside a dashed auxiliary container so the demo area is
  // clear without the frame masquerading as the input's own chrome.
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center w-72 aspect-square overflow-auto rounded-lg border border-dashed border-gray-300 p-8">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof TextInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Empty text field. Typing emits the raw string value via `onChange`. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    await expect(input).toBeInTheDocument();

    // Controlled input (value is forced), so onChange fires per keystroke.
    await userEvent.type(input, "Dom Casmurro");
    await expect(args.onChange).toHaveBeenCalled();
  },
};

/** Field pre-filled with a value. */
export const WithValue: Story = {
  args: { value: "Machado de Assis" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveValue(
      "Machado de Assis",
    );
  },
};

/** Floating-label variant. */
export const WithLabel: Story = {
  args: { label: "Title", value: "" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Title")).toBeInTheDocument();
  },
};

/** Disabled — greyed out and does not accept input. */
export const Disabled: Story = {
  args: { value: "Dom Casmurro", disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toBeDisabled();
  },
};

/** Error state — the field is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { label: "Title", value: "", error: "is required" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    await expect(input).toHaveAttribute("aria-invalid", "true");
  },
};
