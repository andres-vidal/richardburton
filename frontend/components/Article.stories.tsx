import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import { Article } from "./Article";

const meta = {
  title: "Components/Article",
  component: Article,
  args: {
    heading: "Machado de Assis",
    content: <p>A collection of translated works.</p>,
  },
  // A resizable box, so the layout can be seen above and below the `sm`
  // breakpoint.
  decorators: [
    (Story) => (
      <div
        className="overflow-auto rounded border border-gray-300 border-dashed resize"
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

/** A heading and its content. The play test checks that both are rendered. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Machado de Assis" }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("A collection of translated works."),
    ).toBeInTheDocument();
  },
};

/**
 * A line under the heading, pinned with it. The play test checks that it is
 * rendered.
 */
export const WithASubheading: Story = {
  args: {
    heading: "How to search",
    subheading: "Accents may be omitted, and minor misspellings are tolerated.",
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Accents may be omitted/),
    ).toBeVisible();
  },
};

/**
 * An aside beside the content, with its heading in the pinned bar. The play
 * test checks that the aside and its heading are rendered.
 */
export const WithAside: Story = {
  args: {
    aside: <p>Isabel Burton translated Iracema in 1886.</p>,
    asideHeading: <h2>About the Burtons</h2>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("complementary")).toHaveTextContent(
      "Isabel Burton translated Iracema in 1886.",
    );
    await expect(
      canvas.getAllByRole("heading", { name: "About the Burtons" }).length,
    ).toBeGreaterThan(0);
  },
};
