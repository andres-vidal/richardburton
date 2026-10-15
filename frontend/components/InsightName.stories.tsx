import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";

import InsightName from "./InsightName";

const meta = {
  title: "Insights/Insight name",
  component: InsightName,
  args: { label: "Dom Casmurro", detail: "Machado de Assis" },
  decorators: [
    (Story) => (
      <p className="text-sm text-gray-900">
        <Story />
      </p>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof InsightName>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A work with its author as the detail, in grey after a middle dot. The play
 * test checks the text it reads.
 */
export const WithDetail: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent(
      "Dom Casmurro · Machado de Assis",
    );
  },
};

/** A name without a detail is the label alone, with no middle dot. */
export const WithoutDetail: Story = {
  args: { label: "Clarice Lispector", detail: undefined },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent(/^Clarice Lispector$/);
  },
};
