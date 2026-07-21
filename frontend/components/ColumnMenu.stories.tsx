import type { Meta, StoryObj } from "@storybook/react";
import { resetAttributes } from "modules/publication/store";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import ColumnMenu from "./ColumnMenu";

const meta = {
  title: "Publications/Column menu",
  component: ColumnMenu,
  beforeEach: () => resetAttributes(),
  decorators: [
    (Story) => (
      <div className="flex justify-center p-8">
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

// Positioning is verified by geometry (getBoundingClientRect), not screenshots:
// deterministic, environment-independent, and it asserts the actual middleware
// behaviour (offset/flip/shift) rather than pixels.

/**
 * Placement: with room below, the popover opens directly under the trigger
 * (offset 4) and right-aligned to it (placement bottom-end).
 */
export const OpensBelowTheTrigger: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Columns",
    });
    await userEvent.click(trigger);
    const menu = await screen.findByRole("group", {
      name: "Show or hide columns",
    });

    const t = trigger.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    // Below the trigger, separated by the ~4px offset.
    await expect(m.top - t.bottom).toBeGreaterThanOrEqual(3);
    await expect(m.top - t.bottom).toBeLessThanOrEqual(6);
    // Right edges aligned (bottom-end).
    await expect(Math.abs(m.right - t.right)).toBeLessThanOrEqual(1.5);
  },
};

/**
 * Flip: pinned near the bottom of the viewport there is no room below, so
 * floating-ui flips the popover above the trigger.
 */
export const FlipsAboveNearViewportBottom: Story = {
  decorators: [
    (Story) => (
      <div style={{ position: "fixed", bottom: 4, right: 48 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Columns",
    });
    await userEvent.click(trigger);
    const menu = await screen.findByRole("group", {
      name: "Show or hide columns",
    });

    const t = trigger.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    // Flipped: the popover sits entirely above the trigger.
    await expect(m.bottom).toBeLessThanOrEqual(t.top);
  },
};

/**
 * Shift: right-aligned to a trigger at the left edge the popover would overflow
 * the left of the viewport, so floating-ui shifts it back into view.
 */
export const ShiftsIntoViewNearLeftEdge: Story = {
  decorators: [
    (Story) => (
      <div style={{ position: "fixed", top: 48, left: 4 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Columns",
    });
    await userEvent.click(trigger);
    const menu = await screen.findByRole("group", {
      name: "Show or hide columns",
    });

    const m = menu.getBoundingClientRect();
    // Kept within the viewport rather than spilling off the left edge.
    await expect(m.left).toBeGreaterThanOrEqual(0);
  },
};

/** A pointer press outside the popover dismisses it (ColumnMenu's `useDismiss`). */
export const DismissesOnOutsideClick: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Columns",
    });
    await userEvent.click(trigger);
    await screen.findByRole("group", { name: "Show or hide columns" });

    await userEvent.click(document.body);
    await waitFor(() =>
      expect(
        screen.queryByRole("group", { name: "Show or hide columns" }),
      ).not.toBeInTheDocument(),
    );
  },
};

/**
 * autoUpdate: the popover stays anchored to the trigger as the page scrolls —
 * the gap between them is unchanged after scrolling.
 */
export const RepositionsOnScroll: Story = {
  decorators: [
    (Story) => (
      <div style={{ height: "200vh", paddingTop: 40 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Columns",
    });
    await userEvent.click(trigger);
    const menu = await screen.findByRole("group", {
      name: "Show or hide columns",
    });

    const gap = () =>
      menu.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom;
    const before = gap();

    window.scrollBy(0, 80);
    // autoUpdate recomputes the position so the popover follows the trigger.
    await waitFor(() =>
      expect(Math.abs(gap() - before)).toBeLessThanOrEqual(1.5),
    );
  },
};
