import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, within } from "storybook/test";

import ModalHeading from "./ModalHeading";

const LONG = Array.from(
  { length: 12 },
  (_, i) =>
    `Line ${i + 1}: the content a dialog holds, which scrolls under the heading.`,
);

const meta = {
  title: "Layout/Modal heading",
  component: ModalHeading,
  args: { heading: "What is wrong with these rows" },
  // The heading spans its dialog's padding, so a story has to give it the
  // padding and a box short enough to scroll in.
  decorators: [
    (Story) => (
      <div
        // A region that scrolls has to be reachable by keyboard, which is what
        // the real dialog does around this too.
        tabIndex={0}
        className="overflow-y-auto p-8 w-96 h-64 bg-white rounded"
      >
        <Story />
        <div className="space-y-3 text-sm text-gray-700">
          {LONG.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof ModalHeading>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A heading alone, pinned while the content passes under it. */
export const Default: Story = {
  play: async () => {
    await expect(
      screen.getByRole("heading", { name: "What is wrong with these rows" }),
    ).toBeVisible();
  },
};

/** A line under it — what the dialog holds, or how much of it. */
export const WithASubheading: Story = {
  args: {
    subheading: "2 rows cannot be inserted until they are corrected.",
  },
  play: async () => {
    await expect(
      screen.getByText("2 rows cannot be inserted until they are corrected."),
    ).toBeVisible();
  },
};

/**
 * A position set against the heading, for a dialog that is one of a queue. It
 * keeps its place at the end of the bar however long the heading is.
 */
export const WithAPosition: Story = {
  args: {
    heading: "The Devil to Pay in the Backlands",
    subheading: "Resembles one other row of this import.",
    aside: "2 / 3",
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("2 / 3")).toBeVisible();
  },
};

/** A heading too long for the bar is cut rather than allowed to wrap it open. */
export const ALongHeading: Story = {
  args: {
    heading:
      "Migration and the Making of Industrial São Paulo: The History of São Miguel Paulista, 1945–1966",
    aside: "1 / 9",
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("1 / 9")).toBeVisible();
  },
};
