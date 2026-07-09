import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";

import TextArea from "./TextArea";

const meta = {
  title: "Components/Text area",
  component: TextArea,
  tags: ["autodocs"],
  args: { value: "", onChange: fn(), "aria-label": "Description" },
  // The textarea is borderless + `bg-transparent` (it sits on a colored surface
  // in the app). Show it inside a dashed auxiliary container so the demo area is
  // clear without the frame masquerading as the textarea's own chrome.
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center w-72 aspect-square overflow-auto rounded-lg border border-dashed border-gray-300 p-8 bg-stripes-diagonal">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof TextArea>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Empty multi-line field. Typing emits the raw string value via `onChange`. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    await expect(input).toBeInTheDocument();

    await userEvent.type(input, "Notes");
    await expect(args.onChange).toHaveBeenCalled();
  },
};

/** Field pre-filled with a value. */
export const WithValue: Story = {
  args: { value: "A long-form description across several lines." },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toHaveValue(
      "A long-form description across several lines.",
    );
  },
};

/** Floating-label variant. */
export const WithLabel: Story = {
  args: { label: "Description", value: "" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Description"),
    ).toBeInTheDocument();
  },
};

/** Disabled — greyed out and does not accept input. */
export const Disabled: Story = {
  args: { value: "A description that cannot be edited.", disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("textbox")).toBeDisabled();
  },
};

/** Error state — the field is marked invalid via `aria-invalid`. */
export const WithError: Story = {
  args: { label: "Description", value: "", error: "is required" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    await expect(input).toHaveAttribute("aria-invalid", "true");
  },
};
