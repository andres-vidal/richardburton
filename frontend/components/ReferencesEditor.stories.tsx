import type { Meta, StoryObj } from "@storybook/react";
import { FC, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import ReferencesEditor from "./ReferencesEditor";

// ReferencesEditor is controlled — every add/remove/reorder/edit emits a new
// array — so hold `value` in state, otherwise the canvas would never reflect an
// interaction. onChange is still forwarded so `fn()` assertions keep working.
const Controlled: FC<{
  value?: string[];
  onChange?: (references: string[]) => void;
}> = ({ value: initial = [], onChange }) => {
  const [value, setValue] = useState(initial);

  return (
    <ReferencesEditor
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

const meta = {
  title: "Publications/References editor",
  component: ReferencesEditor,
  args: { value: [], onChange: fn() },
  render: (args) => <Controlled value={args.value} onChange={args.onChange} />,
  decorators: [
    // White background: the editor lives in the (white) edit modal, so this is
    // its real contrast context.
    (Story) => (
      <div className="p-6 w-lg max-w-full bg-white rounded-lg border border-gray-200">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof ReferencesEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Fully interactive: add a row, type into it, reorder it, then remove it — the
 * list updates live, mirroring the edit form. Start with one reference so the
 * populated shape is visible before touching anything.
 */
export const Default: Story = {
  args: {
    value: [
      "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Add a second reference and type into it — the new row reflects the input.
    await userEvent.click(
      canvas.getByRole("button", { name: "Add reference" }),
    );
    const second = canvas.getByLabelText("Reference 2");
    await userEvent.type(second, "https://archive.org/details/domcasmurro");
    await expect(second).toHaveValue("https://archive.org/details/domcasmurro");

    // Reorder: move the new row up; it becomes Reference 1.
    await userEvent.click(
      canvas.getByRole("button", { name: "Move reference 2 up" }),
    );
    await expect(canvas.getByLabelText("Reference 1")).toHaveValue(
      "https://archive.org/details/domcasmurro",
    );

    // Remove it; the original returns as the sole row.
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove reference 1" }),
    );
    await expect(canvas.getByLabelText("Reference 1")).toHaveValue(
      "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
    );
    await expect(
      canvas.queryByLabelText("Reference 2"),
    ).not.toBeInTheDocument();
  },
};

/** No references yet — an empty state and the add control. */
export const Empty: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("No references yet.")).toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole("button", { name: "Add reference" }),
    );
    await expect(args.onChange).toHaveBeenCalledWith([""]);
  },
};

/** A populated list: one input per entry, with reorder + remove controls. */
export const WithReferences: Story = {
  args: {
    value: [
      "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
      "https://archive.org/details/domcasmurro0000mach",
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Reference 1")).toHaveValue(
      "Caldwell, Helen. Introduction to Dom Casmurro. Noonday Press, 1953.",
    );
    // The first row cannot move up; the last cannot move down.
    await expect(
      canvas.getByRole("button", { name: "Move reference 1 up" }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: "Move reference 2 down" }),
    ).toBeDisabled();
  },
};

/** Reordering swaps adjacent entries on screen — moving row 2 up swaps the two. */
export const Reorder: Story = {
  args: { value: ["First source", "Second source"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText("Reference 1")).toHaveValue(
      "First source",
    );
    await expect(canvas.getByLabelText("Reference 2")).toHaveValue(
      "Second source",
    );

    await userEvent.click(
      canvas.getByRole("button", { name: "Move reference 2 up" }),
    );

    // The rows have actually swapped.
    await expect(canvas.getByLabelText("Reference 1")).toHaveValue(
      "Second source",
    );
    await expect(canvas.getByLabelText("Reference 2")).toHaveValue(
      "First source",
    );
  },
};

/** Removing an entry drops its row, leaving the rest. */
export const Remove: Story = {
  args: { value: ["First source", "Second source"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("textbox")).toHaveLength(2);

    await userEvent.click(
      canvas.getByRole("button", { name: "Remove reference 1" }),
    );

    // The first row is gone; the second is now the sole row.
    await expect(canvas.getByLabelText("Reference 1")).toHaveValue(
      "Second source",
    );
    await expect(
      canvas.queryByLabelText("Reference 2"),
    ).not.toBeInTheDocument();
  },
};
