import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import Layout from "./Layout";

const meta = {
  title: "Components/Layout",
  component: Layout,
  args: {
    content: <div>Main content</div>,
  },
  // Drag the bottom-right corner to resize; the shell fills the box (h-full).
  decorators: [
    (Story) => (
      <div
        className="resize overflow-auto rounded border border-dashed border-gray-300"
        style={{ width: 900, height: 560, minWidth: 360, minHeight: 280 }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "padded" },
} satisfies Meta<typeof Layout>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The app shell: fixed header/footer around a scrollable main content slot. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Main content")).toBeInTheDocument();
    await expect(
      canvas.getByText("Richard & Isabel Burton Platform"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("Learn More")).toBeInTheDocument();
    await expect(canvas.getByText("Contact Us")).toBeInTheDocument();
  },
};

/** Every optional slot filled — subheader, left aside and footer all render. */
export const AllSlots: Story = {
  args: {
    title: "Home",
    content: <div>Main content</div>,
    subheader: <div>Subheader slot</div>,
    leftAside: <div>Left aside slot</div>,
    footer: <div>Footer slot</div>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Main content")).toBeInTheDocument();
    await expect(canvas.getByText("Subheader slot")).toBeInTheDocument();
    await expect(canvas.getByText("Left aside slot")).toBeInTheDocument();
    await expect(canvas.getByText("Footer slot")).toBeInTheDocument();
  },
};
