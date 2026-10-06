import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import InfoHint from "./InfoHint";

const meta = {
  title: "Components/Info hint",
  component: InfoHint,
  args: {
    label: "About Works",
    message:
      "An original Brazilian book, identified by its title and authors. All its translations and editions count as one work.",
  },
  decorators: [
    (Story) => (
      <div className="flex gap-1 items-center py-16 text-xs text-gray-600">
        Works
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
} satisfies Meta<typeof InfoHint>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Hovering the icon shows the message in a tooltip. */
export const Hovered: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(
      within(canvasElement).getByRole("button", { name: "About Works" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("tooltip")).toHaveTextContent(
        "An original Brazilian book",
      ),
    );
  },
};

/**
 * The icon is a button, so tabbing to it shows the message too, and a tap on
 * a touch screen focuses it.
 */
export const Focused: Story = {
  play: async () => {
    await userEvent.tab();

    await expect(
      screen.getByRole("button", { name: "About Works" }),
    ).toHaveFocus();
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeVisible());
  },
};
