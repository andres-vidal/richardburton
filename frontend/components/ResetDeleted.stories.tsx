import type { Meta, StoryObj } from "@storybook/react";
import { useVisiblePublicationIds } from "modules/publication/hooks";
import { setDeleted } from "modules/publication/store";
import { seed } from "modules/publication/fixtures";
import { FC } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import ResetDeleted from "./ResetDeleted";

// Story-only affordance: in the app, rows are deleted from the table. This
// button deletes the first visible row so the reset button — and its round-trip
// — can be exercised on its own.
const DeleteControls: FC = () => {
  const ids = useVisiblePublicationIds();
  const first = ids?.[0];

  return (
    <button
      className="rounded border border-indigo-600 px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
      disabled={first === undefined}
      onClick={() => first !== undefined && setDeleted([first])}
    >
      Delete a row
    </button>
  );
};

const meta = {
  title: "Publications/Reset deleted",
  component: ResetDeleted,
  decorators: [
    (Story) => (
      <div className="flex flex-col items-center gap-4">
        <DeleteControls />
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof ResetDeleted>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Delete a row → the reset button appears → reset restores it (a full round-trip). */
export const Default: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Nothing deleted yet — no reset button.
    await expect(canvas.queryByRole("button", { name: /Reset/ })).toBeNull();

    // Delete a row → the reset button appears.
    await userEvent.click(canvas.getByRole("button", { name: "Delete a row" }));
    const reset = await canvas.findByRole("button", {
      name: /Reset 1 deleted/,
    });

    // Reset restores it and the button hides again.
    await userEvent.click(reset);
    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: /Reset/ })).toBeNull(),
    );
  },
};
