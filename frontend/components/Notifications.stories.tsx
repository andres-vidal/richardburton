import type { Meta, StoryObj } from "@storybook/react";
import { FC } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import Button from "./Button";
import Notifications, { notify } from "./Notifications";

const LEVELS = [
  { level: "success", label: "Success", message: "Publication deleted" },
  { level: "info", label: "Info", message: "Search index catching up" },
  { level: "warning", label: "Warning", message: "Could not restore" },
  { level: "error", label: "Error", message: "Could not reach the server" },
] as const;

/**
 * Buttons that raise a notification of each level, or seven failures at once,
 * above the stack. The look of a single card is in `Notification`'s stories.
 */
const NotificationsDemo: FC = () => (
  <div className="flex flex-col gap-6 items-center p-6">
    <div className="flex flex-wrap gap-2 justify-center">
      {LEVELS.map(({ level, label, message }) => (
        <Button
          key={level}
          label={`Show ${label}`}
          variant="outline-primary"
          width="fit"
          onClick={() => notify({ level, message })}
        />
      ))}
      <Button
        label="Show seven"
        variant="outline-primary"
        width="fit"
        onClick={() =>
          [1, 2, 3, 4, 5, 6, 7].forEach((n) =>
            notify({ level: "warning", message: `Failure ${n}` }),
          )
        }
      />
    </div>
    <Notifications />
  </div>
);

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

/**
 * A notification raised with `notify` shows near the top of the page, in a
 * portal. The play test raises one and finds it in the notifications region.
 */
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
 * A confirmation disappears after four seconds, and a failure stays until it
 * is dismissed. The play test raises both, waits, and dismisses the failure.
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

/**
 * Beyond five notifications, four show and the rest are summarised as a count.
 * The play test raises seven.
 */
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
