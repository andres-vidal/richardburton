import type { Meta, StoryObj } from "@storybook/react";
import { resetAttributes } from "modules/publication";
import { expect, userEvent, within } from "storybook/test";

import ColumnMenu from "./ColumnMenu";

const meta = {
  title: "Publications/Column menu",
  component: ColumnMenu,
  beforeEach: () => resetAttributes(),
  decorators: [
    (Story) => (
      <div className="flex justify-end p-8">
        <Story />
      </div>
    ),
  ],
  parameters: {
    a11y: {
      config: {
        // Floating UI's focus guards are intentionally `tabindex=0` + `aria-hidden`
        // (a focus-trap technique); axe's aria-hidden-focus flags them as a false
        // positive. Dropping the focus manager would leave the portalled popover
        // keyboard-unreachable, which is worse — so we silence just this rule.
        rules: [{ id: "aria-hidden-focus", enabled: false }],
      },
    },
  },
} satisfies Meta<typeof ColumnMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Opening the menu and toggling a column off flips its checkbox. The popover is
 * portalled to the document body, so it's queried there rather than in the canvas.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Columns" }));

    const menu = within(document.body);
    const year = await menu.findByRole("button", {
      name: "Year",
      pressed: true,
    });
    await userEvent.click(year);
    await menu.findByRole("button", { name: "Year", pressed: false });

    // Restoring everything re-checks it.
    await userEvent.click(menu.getByRole("button", { name: "Show all" }));
    await expect(menu.getByRole("button", { name: "Year" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};
