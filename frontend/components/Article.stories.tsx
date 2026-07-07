import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import { Article } from "./Article";

const meta = {
  title: "Components/Article",
  component: Article,
  tags: ["autodocs"],
  args: {
    heading: "Machado de Assis",
    content: <p>A collection of translated works.</p>,
  },
  // Drag the bottom-right corner to resize and watch the layout reflow.
  decorators: [
    (Story) => (
      <div
        className="resize overflow-auto rounded border border-dashed border-gray-300"
        style={{ width: 720, height: 480, minWidth: 320, minHeight: 240 }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof Article>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The base layout: a heading and its content section. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: "Machado de Assis" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("A collection of translated works."),
    ).toBeInTheDocument();
  },
};

/** With an aside, the content and aside share the row. */
export const WithAside: Story = {
  args: { aside: <nav>Related links</nav> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Related links")).toBeInTheDocument();
  },
};
