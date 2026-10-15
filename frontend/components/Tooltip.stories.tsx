import type { Meta, StoryObj } from "@storybook/react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import Button from "./Button";
import Tooltip from "./Tooltip";

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  args: {
    message: "Something needs your attention",
    children: <Button label="Hover me" variant="outline" width="fit" />,
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

/** Hovering the child shows `message` in a tooltip. */
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
 * By default the tooltip sits above its child, 5px away. The play test checks
 * the positions of the two.
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
 * At the top of the viewport there is no room above the child, so the tooltip
 * flips below it. The play test checks the positions of the two.
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
 * Centred on a child at the right edge, the tooltip would overflow the
 * viewport, so it shifts back into view. The play test checks its edges.
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
 * `placement="bottom"` puts the tooltip below its child. The play test checks
 * the positions of the two.
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

/**
 * With an empty `message`, the child renders alone. The play test hovers it
 * and checks that no tooltip appears.
 */
export const NoMessage: Story = {
  args: { message: "" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Hover me" });

    await userEvent.hover(trigger);
    await expect(screen.queryByRole("tooltip")).toBeNull();
  },
};

/** A long message wraps at a readable width instead of stretching across the page. */
export const LongMessage: Story = {
  args: {
    variant: "info",
    message:
      "A first translation is the first edition of a work's first translation. A retranslation is the first edition of a later translation of the same work. A reissue is any later edition of a translation.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole("button", { name: "Hover me" }));
    await waitFor(() =>
      expect(
        screen.getByText(/^A first translation/).getBoundingClientRect().width,
      ).toBeLessThanOrEqual(320),
    );
  },
};
