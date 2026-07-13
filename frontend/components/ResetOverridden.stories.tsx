import type { Meta, StoryObj } from "@storybook/react";
import { useVisiblePublicationIds } from "modules/publication/hooks";
import { overrideField } from "modules/publication/store";
import { seed } from "modules/publication/fixtures";
import { FC } from "react";
import { expect, userEvent, within } from "storybook/test";

import ResetOverridden from "./ResetOverridden";

// Story-only affordance: in the app, cells are edited in the table. This button
// overrides a field on the first row so the reset button can be exercised on its
// own — edit again after resetting to repeat the round-trip.
const OverrideControls: FC = () => {
  const ids = useVisiblePublicationIds();
  const first = ids?.[0];

  return (
    <button
      className="rounded border border-indigo-600 px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
      disabled={first === undefined}
      onClick={() =>
        first !== undefined && overrideField(first, "title", "Edited title")
      }
    >
      Edit a field
    </button>
  );
};

const meta = {
  title: "Publications/Reset overridden",
  component: ResetOverridden,
  decorators: [
    (Story) => (
      <div className="flex flex-col items-center gap-4">
        <OverrideControls />
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof ResetOverridden>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Edit a field and the reset button appears to revert it. (Clicking reset also
 * re-validates against the server, so the story stops at the button appearing;
 * "Edit a field" lets you repeat the round-trip.)
 */
export const Default: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByRole("button", { name: /Reset/ })).toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: "Edit a field" }));
    await expect(
      await canvas.findByRole("button", { name: /Reset 1 overriden/ }),
    ).toBeInTheDocument();
  },
};
