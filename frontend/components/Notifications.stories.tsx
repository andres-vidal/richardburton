import type { Meta, StoryObj } from "@storybook/react";
import { FC } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import Notifications, { useNotify } from "./Notifications";

const LEVELS = [
  { level: "success", label: "Success", message: "Your changes were saved" },
  { level: "info", label: "Info", message: "Heads up — just so you know" },
  {
    level: "warning",
    label: "Warning",
    message: "This may need your attention",
  },
  { level: "error", label: "Error", message: "Something went wrong" },
] as const;

// Toasts are triggered imperatively, so give the story real buttons to fire
// them. Each snackbar renders in a FloatingPortal, fixed near the top.
const NotificationsDemo: FC = () => {
  const notify = useNotify();

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="flex flex-wrap justify-center gap-2">
        {LEVELS.map(({ level, label, message }) => (
          <button
            key={level}
            className="rounded border border-indigo-600 px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50"
            onClick={() => notify({ level, message })}
          >
            Show {label}
          </button>
        ))}
      </div>
      <Notifications />
    </div>
  );
};

const meta = {
  title: "Components/Notifications",
  component: Notifications,
  tags: ["autodocs"],
  render: () => <NotificationsDemo />,
  parameters: {
    layout: "fullscreen",
    // Snackbars render fixed/portalled near the top; bound them on the docs page
    // so they don't cover it (they auto-dismiss after a few seconds).
    docs: { story: { inline: false, height: "18rem" } },
  },
} satisfies Meta<typeof Notifications>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Click a level to fire a toast. It appears top-center (a FloatingPortal), stacks
 * with others, and auto-dismisses after a few seconds.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Show Success" }),
    );

    // The snackbar renders in a portal, outside the story canvas.
    await waitFor(() =>
      expect(screen.getByText("Your changes were saved")).toBeInTheDocument(),
    );
  },
};
