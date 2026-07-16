import type { Meta, StoryObj } from "@storybook/react";
import { colord, extend } from "colord";
import a11yPlugin from "colord/plugins/a11y";
import { expect, fn, userEvent, within } from "storybook/test";

import TextInput from "./TextInput";

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
 * WCAG contrast ratio between an element's text and what is painted behind it.
 *
 * Storybook's a11y addon can't cover this: axe abstains here — "background color
 * could not be determined due to a background gradient" — and reports
 * *incomplete*, which `a11y: { test: "error" }` does not fail on. Compositing the
 * stack ourselves turns that into a definite number.
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
  tags: ["autodocs"],
  args: { value: "", onChange: fn(), "aria-label": "Title" },
  // The input is borderless + `bg-transparent` (it sits on a colored surface in
  // the app). Show it inside a dashed auxiliary container so the demo area is
  // clear without the frame masquerading as the input's own chrome.
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

/**
 * `bordered` — the outlined variant for standalone forms (e.g. the edit modal):
 * a visible box with `text-sm`. The default borderless look is what the dense
 * table cells rely on.
 */
export const Bordered: Story = {
  args: { bordered: true, value: "Dom Casmurro", "aria-label": "Title" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    const box = input.closest("[data-bordered='true']")!;
    await expect(getComputedStyle(box).borderTopWidth).toBe("1px");
  },
};

/**
 * Errored + focused, **bordered** (outlined form) variant: the text must stay
 * dark and readable. The subtle variant's white-on-red treatment would be
 * white-on-white here — regression guard for that.
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
    // The subtle variant's white-on-red treatment would be white-on-white here.
    await expect(textContrast(input)).toBeGreaterThanOrEqual(4.5);
  },
};

/**
 * Errored + focused, **subtle** (dense table) variant: fills red with white
 * text — a strong error signal. Guards the stray-comma bug that had voided the
 * red focus fill (leaving white text on the near-white focus background).
 */
export const ErrorFocusedSubtle: Story = {
  args: { error: "must be a number", value: "nineteen" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox");
    await userEvent.click(input);
    await expect(input).toHaveFocus();
    // The bug left the text unreadable on the near-white focus background.
    await expect(textContrast(input)).toBeGreaterThanOrEqual(4.5);
  },
};
