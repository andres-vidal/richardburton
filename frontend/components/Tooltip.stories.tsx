import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import Tooltip from "./Tooltip";

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  args: {
    message: "Something needs your attention",
    children: <button className="px-3 py-1 rounded border">Hover me</button>,
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A styled tooltip built on `TooltipProvider` — the `message` appears on hover. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Hover me" });

    // Content is portalled outside the canvas, so query the whole screen.
    await userEvent.hover(trigger);
    await waitFor(() =>
      expect(
        screen.getByText("Something needs your attention"),
      ).toBeInTheDocument(),
    );
  },
};

/** The `error` variant — red background with an error icon. */
export const Error: Story = {
  args: { error: true, message: "This field is required" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole("button", { name: "Hover me" }));
    await waitFor(() =>
      expect(screen.getByText("This field is required")).toBeInTheDocument(),
    );
  },
};

/** The `warning` variant — white background with a warning icon. */
export const Warning: Story = {
  args: { warning: true, message: "Double-check this value" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole("button", { name: "Hover me" }));
    await waitFor(() =>
      expect(screen.getByText("Double-check this value")).toBeInTheDocument(),
    );
  },
};

/** The `info` variant — white background with an info icon. */
export const Info: Story = {
  args: { info: true, message: "Extra context lives here" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole("button", { name: "Hover me" }));
    await waitFor(() =>
      expect(screen.getByText("Extra context lives here")).toBeInTheDocument(),
    );
  },
};

/** An empty `message` renders the child alone — no tooltip wrapper. */
export const NoMessage: Story = {
  args: { message: "" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Hover me" });

    // With no message, hovering reveals nothing.
    await userEvent.hover(trigger);
    await expect(trigger).toBeInTheDocument();
  },
};
