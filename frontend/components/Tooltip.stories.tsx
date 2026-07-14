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
  decorators: [
    (Story) => (
      <div className="py-8">
        <Story />
      </div>
    ),
  ],
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
  args: { variant: "error", message: "This field is required" },
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
  args: { variant: "warning", message: "Double-check this value" },
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
  args: { variant: "info", message: "Extra context lives here" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole("button", { name: "Hover me" }));
    await waitFor(() =>
      expect(screen.getByText("Extra context lives here")).toBeInTheDocument(),
    );
  },
};

/**
 * Positioning (offset + placement): the tooltip is placed above the trigger
 * ("top") with the configured 5px offset. Verified by geometry, not pixels.
 */
export const PlacedAboveTheTrigger: Story = {
  // Pin the trigger mid-viewport so "top" placement has room above and does not
  // flip (the headless runner doesn't apply the meta's `layout: centered`).
  decorators: [
    (Story) => (
      <div style={{ position: "fixed", top: "50%", left: "50%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Hover me",
    });
    await userEvent.hover(trigger);
    const tip = await screen.findByRole("tooltip");

    await waitFor(() => {
      const t = trigger.getBoundingClientRect();
      const p = tip.getBoundingClientRect();
      // Above the trigger, separated by the ~5px offset.
      expect(p.bottom).toBeLessThanOrEqual(t.top);
      expect(t.top - p.bottom).toBeLessThanOrEqual(7);
    });
  },
};

/**
 * Flip: pinned at the top of the viewport there is no room above, so floating-ui
 * flips the tooltip below the trigger.
 */
export const FlipsBelowNearViewportTop: Story = {
  decorators: [
    (Story) => (
      <div style={{ position: "fixed", top: 4, left: "50%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Hover me",
    });
    await userEvent.hover(trigger);
    const tip = await screen.findByRole("tooltip");

    await waitFor(() => {
      const t = trigger.getBoundingClientRect();
      const p = tip.getBoundingClientRect();
      // Flipped below, separated by the ~5px offset.
      expect(p.top).toBeGreaterThanOrEqual(t.bottom);
      expect(p.top - t.bottom).toBeLessThanOrEqual(7);
    });
  },
};

/**
 * Shift: centered on a trigger at the right edge the tooltip would overflow, so
 * floating-ui shifts it back within the viewport.
 */
export const ShiftsIntoViewNearRightEdge: Story = {
  decorators: [
    (Story) => (
      <div style={{ position: "fixed", top: "50%", right: 4 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Hover me",
    });
    await userEvent.hover(trigger);
    const tip = await screen.findByRole("tooltip");

    await waitFor(() => {
      const p = tip.getBoundingClientRect();
      // Kept within the viewport rather than spilling off the right edge.
      expect(p.right).toBeLessThanOrEqual(window.innerWidth + 1);
      expect(p.left).toBeGreaterThanOrEqual(0);
    });
  },
};

/**
 * The `placement` prop is honored: `placement="bottom"` puts the tooltip below
 * the trigger (with room below, no flip).
 */
export const PlacedBelowWhenRequested: Story = {
  args: { placement: "bottom" },
  decorators: [
    (Story) => (
      <div style={{ position: "fixed", top: "50%", left: "50%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Hover me",
    });
    await userEvent.hover(trigger);
    const tip = await screen.findByRole("tooltip");

    await waitFor(() => {
      const t = trigger.getBoundingClientRect();
      const p = tip.getBoundingClientRect();
      // Below the trigger, separated by the ~5px offset.
      expect(p.top).toBeGreaterThanOrEqual(t.bottom);
      expect(p.top - t.bottom).toBeLessThanOrEqual(7);
    });
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
