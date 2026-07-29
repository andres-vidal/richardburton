import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent } from "storybook/test";

import AuthCard from "./AuthCard";
import Button from "./Button";

const meta = {
  title: "Auth/Auth card",
  component: AuthCard,
  args: {
    title: "Something happened",
    children: <p className="text-lg">One line saying what it was.</p>,
    action: <Button label="Do the next thing" width="fit" onClick={fn()} />,
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuthCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A title, what happened, and the one thing to do about it. */
export const Default: Story = {
  play: async () => {
    await expect(
      screen.getByRole("heading", { level: 1, name: "Something happened" }),
    ).toBeVisible();

    const action = screen.getByRole("button", { name: "Do the next thing" });
    await userEvent.click(action);
    await expect(action).toBeVisible();
  },
};

/** A second, quieter line saying what it means for the reader. */
export const WithASecondLine: Story = {
  args: {
    children: (
      <>
        <p className="text-lg">One line saying what it was.</p>
        <p className="text-sm">
          A quieter one saying what it means for whoever is reading.
        </p>
      </>
    ),
  },
  play: async () => {
    await expect(screen.getByText(/what it means/)).toBeVisible();
  },
};

/** Nothing to do next: the foot is empty and the card keeps its shape. */
export const WithoutAnAction: Story = {
  args: { action: undefined },
  play: async () => {
    await expect(
      screen.getByRole("heading", { name: "Something happened" }),
    ).toBeVisible();
    await expect(screen.queryByRole("button")).toBeNull();
  },
};
