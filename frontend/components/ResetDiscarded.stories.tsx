import type { Meta, StoryObj } from "@storybook/react";
import { useVisiblePublicationIds } from "modules/publication/hooks";
import { setDiscarded } from "modules/publication/store";
import { seed } from "modules/publication/fixtures";
import { FC } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import ResetDiscarded from "./ResetDiscarded";

// Story-only affordance: in the app, rows are discarded from the table. This
// button discards the first visible row so the reset button — and its round-trip
// — can be exercised on its own.
const DiscardControls: FC = () => {
  const ids = useVisiblePublicationIds();
  const first = ids?.[0];

  return (
    <button
      className="rounded border border-indigo-600 px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
      disabled={first === undefined}
      onClick={() => first !== undefined && setDiscarded([first])}
    >
      Discard a row
    </button>
  );
};

const meta = {
  title: "Publications/Reset discarded",
  component: ResetDiscarded,
  decorators: [
    (Story) => (
      <div className="flex flex-col items-center gap-4">
        <DiscardControls />
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof ResetDiscarded>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Discard a row → the reset button appears → reset restores it (a full round-trip). */
export const Default: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Nothing discarded yet — no reset button.
    await expect(canvas.queryByRole("button", { name: /Reset/ })).toBeNull();

    // Discard a row → the reset button appears.
    await userEvent.click(
      canvas.getByRole("button", { name: "Discard a row" }),
    );
    const reset = await canvas.findByRole("button", {
      name: /Reset 1 discarded/,
    });

    // Reset restores it and the button hides again.
    await userEvent.click(reset);
    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: /Reset/ })).toBeNull(),
    );
  },
};
