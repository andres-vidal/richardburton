import type { Meta, StoryObj } from "@storybook/react";
import { colord, extend } from "colord";
import a11yPlugin from "colord/plugins/a11y";
import { ComponentProps, FC, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import TextInput from "./TextInput";

// TextInput is controlled. This wrapper holds `value` in state, so typing
// shows on screen.
const Controlled: FC<ComponentProps<typeof TextInput>> = ({
  value: initial,
  onChange,
  ...props
}) => {
  const [value, setValue] = useState(initial);
  return (
    <TextInput
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

extend([a11yPlugin]);

// Paint `colors` over one another on a 1px canvas and read the result as sRGB.
// This is the part colord can't do: it resolves alpha compositing, and Tailwind
// v4 computes to `oklch`, which colord cannot parse.
function paint(colors: string[]): string {
  const ctx = document.createElement("canvas").getContext("2d")!;
  for (const color of colors) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
  }
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

// Every background painted behind `el`, page-first. The input is `bg-transparent`
// and the error fill is translucent, so the colour behind the text only exists
// once the whole stack is composited.
function backgroundsBehind(el: HTMLElement): string[] {
  const ancestors: HTMLElement[] = [];
  for (let n: HTMLElement | null = el; n; n = n.parentElement)
    ancestors.unshift(n);
  return ["#fff", ...ancestors.map((n) => getComputedStyle(n).backgroundColor)];
}

/**
 * Returns the WCAG contrast ratio between an element's text and what is
 * painted behind it.
 *
 * The a11y addon does not measure this here. Axe cannot determine a background
 * painted under a gradient, so it reports the check as incomplete, and
 * `a11y: { test: "error" }` does not fail on that. Compositing the stack here
 * gives a definite number.
 */
function textContrast(el: HTMLElement): number {
  const behind = backgroundsBehind(el);
  return colord(paint(behind)).contrast(
    paint([...behind, getComputedStyle(el).color]),
  );
}

const meta = {
  title: "Components/Text input",
  component: TextInput,
  args: { value: "", onChange: fn(), "aria-label": "Title" },
  render: (args) => <Controlled {...args} />,
  // The borderless input sits on a coloured surface in the app. The dashed
  // frame marks out the story's area, and is not part of the field.
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center w-72 aspect-square overflow-auto rounded-lg border border-dashed border-gray-300 p-8 bg-stripes-diagonal">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof TextInput>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Empty text field. Typing updates the value and emits it via `onChange`. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    await expect(input).toBeInTheDocument();

    await userEvent.type(input, "Dom Casmurro");
    await expect(input).toHaveValue("Dom Casmurro");
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

/** `bordered` outlines the field, for a form. The play test checks the border. */
export const Bordered: Story = {
  args: { bordered: true, value: "Dom Casmurro", "aria-label": "Title" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    const box = input.closest("[data-bordered='true']")!;
    await expect(getComputedStyle(box).borderTopWidth).toBe("1px");
  },
};

/**
 * A bordered field with an error, focused. The play test checks that the text
 * keeps a contrast of at least 4.5 against the field.
 */
export const ErrorFocusedBordered: Story = {
  args: {
    bordered: true,
    error: "must be a number",
    value: "nineteen",
    "aria-label": "Year",
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    await userEvent.click(input);
    await expect(input).toHaveFocus();
    await expect(textContrast(input)).toBeGreaterThanOrEqual(4.5);
  },
};

/**
 * A borderless field with an error, focused. It fills red. The play test
 * checks that the text keeps a contrast of at least 4.5 against the fill.
 */
export const ErrorFocusedSubtle: Story = {
  args: { error: "must be a number", value: "nineteen" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    await userEvent.click(input);
    await expect(input).toHaveFocus();
    await expect(textContrast(input)).toBeGreaterThanOrEqual(4.5);
  },
};
