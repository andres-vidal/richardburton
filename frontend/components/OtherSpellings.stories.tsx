import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";

import OtherSpellings from "./OtherSpellings";

const meta = {
  title: "Admin/Other spellings",
  component: OtherSpellings,
  args: {
    label: "Already here as",
    spellings: [
      { id: 1, name: "Alfred A. Knopf", publications: 21 },
      { id: 2, name: "Alfred Knopf", publications: 1 },
    ],
    onPick: fn(),
  },
  // The line sits in an amber entry of a list, on a white page.
  decorators: [
    (Story) => (
      <div className="p-4 w-96 bg-amber-50 rounded border border-amber-300">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof OtherSpellings>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Two spellings, each with its publication count. The play test presses one
 * and checks that `onPick` receives it.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", {
        name: "Alfred A. Knopf 21 publications",
      }),
    );

    await expect(args.onPick).toHaveBeenCalledWith(args.spellings[0]);
  },
};

/** A spelling no publication credits reads "unused" instead of a count. */
export const Unused: Story = {
  args: {
    label: "Also here as",
    spellings: [{ id: 4, name: "Peter Owen Ltd", publications: 0 }],
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", {
        name: "Peter Owen Ltd unused",
      }),
    ).toBeVisible();
  },
};
