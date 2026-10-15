import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import Button from "./Button";
import TooltipProvider from "./TooltipProvider";

const meta = {
  title: "Components/TooltipProvider",
  component: TooltipProvider,
  args: {
    content: (
      <div className="py-1 px-2 text-sm text-white bg-gray-800 rounded shadow">
        Tooltip content
      </div>
    ),
    children: <Button label="Hover me" variant="outline" width="fit" />,
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof TooltipProvider>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Hovering the child shows `content` in a tooltip. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Hover me" });

    // Floating content is portalled outside the canvas, so query the whole screen.
    await userEvent.hover(trigger);
    await waitFor(() =>
      expect(screen.getByText("Tooltip content")).toBeInTheDocument(),
    );
  },
};

/** Focusing the child shows the tooltip too. */
export const OpensOnFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Hover me" });

    trigger.focus();
    await waitFor(() =>
      expect(screen.getByText("Tooltip content")).toBeInTheDocument(),
    );
  },
};
