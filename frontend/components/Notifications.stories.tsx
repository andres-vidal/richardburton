import type { Meta, StoryObj } from "@storybook/react";
import { FC } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import Notifications, { useNotify } from "./Notifications";

const LEVELS = [
  { level: "success", label: "Success", message: "Publication deleted" },
  { level: "info", label: "Info", message: "Search index catching up" },
  { level: "warning", label: "Warning", message: "Could not restore" },
  { level: "error", label: "Error", message: "Could not reach the server" },
] as const;

// The container is driven imperatively, so the story needs real triggers. What
// a single card looks like belongs to Notification's own stories; these are
// about placement, stacking and lifetime.
const NotificationsDemo: FC = () => {
  const notify = useNotify();

  return (
    <div className="flex flex-col gap-6 items-center p-6">
      <div className="flex flex-wrap gap-2 justify-center">
        {LEVELS.map(({ level, label, message }) => (
          <button
            key={level}
            className="px-3 py-1 text-sm text-indigo-600 rounded border border-indigo-600 focus-ring hover:bg-indigo-50"
            onClick={() => notify({ level, message })}
          >
            Show {label}
          </button>
        ))}
        <button
          className="px-3 py-1 text-sm text-indigo-600 rounded border border-indigo-600 focus-ring hover:bg-indigo-50"
          onClick={() =>
            [1, 2, 3, 4, 5, 6, 7].forEach((n) =>
              notify({ level: "warning", message: `Failure ${n}` }),
            )
          }
        >
          Show seven
        </button>
      </div>
      <Notifications />
    </div>
  );
};

const meta = {
  title: "Components/Notifications",
  component: Notifications,
  render: () => <NotificationsDemo />,
  parameters: {
    layout: "fullscreen",
    // The stack is fixed and portalled near the top; bound it on the docs page
    // so it doesn't cover the prose.
    docs: { story: { inline: false, height: "22rem" } },
  },
} satisfies Meta<typeof Notifications>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Raised from anywhere, rendered top-center in a portal. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Show Success" }),
    );

    // Outside the story canvas: the stack is portalled to the body.
    await waitFor(() =>
      expect(screen.getByText("Publication deleted")).toBeInTheDocument(),
    );
    await expect(
      screen.getByRole("region", { name: "Notifications" }),
    ).toBeInTheDocument();
  },
};

/**
 * A confirmation clears itself after a few seconds. A failure does not: it
 * waits to be dismissed, because a message that vanishes before it is read is
 * no message at all.
 */
export const FailuresWaitToBeDismissed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Show Error" }));
    const failure = await screen.findByRole("alert");
    await expect(failure).toHaveTextContent("Could not reach the server");

    await userEvent.click(canvas.getByRole("button", { name: "Show Success" }));
    await expect(await screen.findByRole("status")).toHaveTextContent(
      "Publication deleted",
    );

    // The confirmation goes on its own; the failure is still there.
    await waitFor(
      () =>
        expect(
          screen.queryByText("Publication deleted"),
        ).not.toBeInTheDocument(),
      { timeout: 8000 },
    );
    await expect(
      screen.getByText("Could not reach the server"),
    ).toBeInTheDocument();

    // Dismissing removes that one only.
    await userEvent.click(
      within(failure).getByRole("button", { name: "Dismiss notification" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByText("Could not reach the server"),
      ).not.toBeInTheDocument(),
    );
  },
};

/** Beyond five, the remainder is summarised rather than burying the page. */
export const StacksAndSummarises: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Show seven" }),
    );

    // Four shown plus a summary of the rest.
    await waitFor(() => expect(screen.getByText("Failure 1")).toBeVisible());
    await expect(screen.getByText(/more notifications/)).toBeInTheDocument();
    await expect(screen.queryByText("Failure 7")).not.toBeInTheDocument();
  },
};
