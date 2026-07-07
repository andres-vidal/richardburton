import type { Meta, StoryObj } from "@storybook/react";
import { fieldErrors, seed } from "modules/publication/fixtures";
import { expect, waitFor, within } from "storybook/test";

import PublicationReview from "./PublicationReview";

const meta = {
  title: "Publications/Review",
  component: PublicationReview,
  decorators: [
    (Story) => (
      <div className="overflow-x-auto p-4">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PublicationReview>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The editable review table — an inline input per cell, plus the "new row". */
export const Default: Story = {
  beforeEach: () => seed(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // header + 3 seeded rows + the always-present new-publication row.
    await expect(canvas.getAllByRole("row")).toHaveLength(5);
  },
};

/** Field-level validation errors — the title and year cells are flagged. */
export const WithInvalidRow: Story = {
  beforeEach: () =>
    seed([
      { title: "Dom Casmurro", authors: "Helen Caldwell", year: "1953" },
      {
        title: "",
        year: "MCMLXI",
        errors: fieldErrors({ title: "required", year: "integer" }),
      },
    ]),
  play: async ({ canvasElement }) => {
    // The flagged fields mark their inputs invalid (red cell + aria-invalid);
    // the valid row and the new row don't.
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll('[aria-invalid="true"]').length,
      ).toBeGreaterThan(0),
    );
  },
};
