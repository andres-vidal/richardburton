import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";

import Notification from "./Notification";

const meta = {
  title: "Components/Notification",
  component: Notification,
  args: {
    level: "success",
    message: "Publication deleted",
    detail:
      "“Dom Casmurro” is out of the database. Restore it from Deleted publications.",
    onDismiss: fn(),
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof Notification>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A headline naming what happened, and a detail saying what to do about it. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Publication deleted")).toBeInTheDocument();
    await expect(
      canvas.getByText(/Restore it from Deleted publications/),
    ).toBeInTheDocument();

    // Confirmations announce politely rather than interrupting.
    await expect(canvas.getByRole("status")).toBeInTheDocument();
    await expect(args.onDismiss).not.toHaveBeenCalled();
  },
};

/** The detail is optional; short confirmations do without one. */
export const MessageOnly: Story = {
  args: { message: "Publication restored", detail: undefined },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("status");

    await expect(card).toHaveTextContent("Publication restored");
    await expect(card.textContent).not.toContain("database");
  },
};

/**
 * A failure interrupts (`role="alert"`) instead of announcing politely, and its
 * detail carries the way out rather than just restating the failure.
 */
export const Failure: Story = {
  args: {
    level: "warning",
    message: "Could not restore — the record exists again",
    detail:
      "It was imported again while deleted, so restoring would duplicate it. Delete the newer copy first, or leave this one deleted.",
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
      /Delete the newer copy first/,
    );
  },
};

/** Every level, so the semantic edges can be compared at a glance. */
export const Levels: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Notification
        level="success"
        message="Publication updated"
        detail="“Iracema” is saved."
        onDismiss={fn()}
      />
      <Notification
        level="info"
        message="Search index catching up"
        detail="Recent edits appear in results within a few seconds."
        onDismiss={fn()}
      />
      <Notification
        level="warning"
        message="Could not undo — another publication holds that data"
        detail="Reverting these fields would duplicate an existing record."
        onDismiss={fn()}
      />
      <Notification
        level="error"
        message="Could not reach the server"
        detail="Your edits are still here. Check your connection and try again."
        onDismiss={fn()}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Confirmations are polite, failures assertive — two of each.
    await expect(canvas.getAllByRole("status")).toHaveLength(2);
    await expect(canvas.getAllByRole("alert")).toHaveLength(2);
  },
};

/** Dismissing is the caller's business; the card only reports the click. */
export const Dismissing: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", {
        name: "Dismiss notification",
      }),
    );
    await expect(args.onDismiss).toHaveBeenCalledTimes(1);
  },
};

/** Without `onDismiss` there is no button — the stack summary uses this. */
export const NotDismissible: Story = {
  args: {
    level: "info",
    message: "3 more notifications",
    detail: undefined,
    onDismiss: undefined,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole("button", {
        name: "Dismiss notification",
      }),
    ).not.toBeInTheDocument();
  },
};

/** Long titles and addresses wrap rather than being clipped. */
export const LongContent: Story = {
  args: {
    level: "success",
    message: "Publication updated",
    detail:
      "“Memoirs of a Militia Sergeant: A Chronicle of the Seventeenth Century in Rio de Janeiro” is saved, edited by averyverylongaddress@richardburton.example.com.",
  },
  play: async ({ canvasElement }) => {
    const detail = within(canvasElement).getByText(/Memoirs of a Militia/);

    // Wrapped onto more than one line, with nothing truncated away.
    await expect(detail.getBoundingClientRect().height).toBeGreaterThan(20);
    await expect(detail.scrollWidth).toBeLessThanOrEqual(
      detail.clientWidth + 1,
    );
  },
};
