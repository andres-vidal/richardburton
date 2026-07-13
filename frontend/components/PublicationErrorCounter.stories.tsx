import type { Meta, StoryObj } from "@storybook/react";
import { resetAll } from "modules/publication/store";
import { fieldErrors, seed } from "modules/publication/fixtures";
import { expect, within } from "storybook/test";

import PublicationErrorCounter from "./PublicationErrorCounter";

const meta = {
  title: "Publications/Publication error counter",
  component: PublicationErrorCounter,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PublicationErrorCounter>;

export default meta;

type Story = StoryObj<typeof meta>;

/** One invalid row among valid ones — the counter shows "1". */
export const Default: Story = {
  beforeEach: () =>
    seed([
      { title: "", errors: fieldErrors({ title: "required" }) },
      { title: "Dom Casmurro" },
      { title: "The Hour of the Star" },
    ]),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", {
      name: "1 invalid publications",
    });
    await expect(button).toBeInTheDocument();
    await expect(button).toHaveTextContent("1");
  },
};

/** Two invalid rows — the counter shows "2". */
export const MultipleErrors: Story = {
  beforeEach: () =>
    seed([
      { title: "", errors: fieldErrors({ title: "required" }) },
      { year: "abc", errors: fieldErrors({ year: "integer" }) },
      { title: "The Hour of the Star" },
    ]),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", {
        name: "2 invalid publications",
      }),
    ).toBeInTheDocument();
  },
};

/** All rows valid — a green check instead of a red count. */
export const AllValid: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("status", { name: "All publications are valid" }),
    ).toBeInTheDocument();
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** Nothing loaded — the counter hides entirely. */
export const Empty: Story = {
  beforeEach: () => resetAll(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvas.queryByRole("status")).toBeNull();
  },
};
