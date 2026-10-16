import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen } from "storybook/test";
import { paragraph } from "test/rich-text-fixtures";
import { editorOf } from "test/slate";

import LazyRichTextArea from "./LazyRichTextArea";

const meta = {
  title: "Components/Lazy rich text area",
  component: LazyRichTextArea,
  args: {
    label: "Notes",
    hint: "Shown to everyone on the publication's page.",
    placeholder: "Notes about this publication",
    value: null,
    onChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="p-6 w-lg max-w-full bg-white rounded-lg border border-gray-200">
        <div data-testid="field">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof LazyRichTextArea>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The empty field once its code has loaded, with a one-line label and hint.
 * The play test checks that it is 247px tall, as tall as the box that holds
 * its place while it loads.
 */
export const Empty: Story = {
  play: async () => {
    await screen.findByRole("textbox", { name: "Notes" });

    await expect(
      screen.getByTestId("field").getBoundingClientRect().height,
    ).toBe(247);
  },
};

/** The field with a value: it takes the same props as the rich text area. */
export const WithValue: Story = {
  args: { value: [paragraph("Reprinted in 1922.")] },
  play: async () => {
    const textbox = await screen.findByRole("textbox", { name: "Notes" });

    await expect(editorOf(textbox).children).toEqual([
      paragraph("Reprinted in 1922."),
    ]);
  },
};
