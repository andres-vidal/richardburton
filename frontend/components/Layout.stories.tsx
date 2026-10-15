import type { Meta, StoryObj } from "@storybook/react";
import { SessionProvider } from "modules/session";
import { expect, within } from "storybook/test";

import Layout from "./Layout";

const meta = {
  title: "Components/Layout",
  component: Layout,
  args: {
    content: <div>Main content</div>,
  },
  // A resizable box, so the layout can be seen at different widths.
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

/**
 * The banner over the content. The play test checks the content, the app's
 * name and the links to Learn More and Contact Us.
 */
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

/** Signed in, the banner offers Sign out. The play test checks the button. */
export const SignedIn: Story = {
  decorators: [
    (Story) => (
      <SessionProvider session={{ email: "me@rb.test", role: "admin" }}>
        <Story />
      </SessionProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "Sign out" }),
    ).toBeVisible();
  },
};

/** Signed out, the banner has no Sign out. */
export const SignedOut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Sign out" })).toBeNull();
  },
};

/** The subheader and the footer filled. The play test checks both. */
export const AllSlots: Story = {
  args: {
    content: <div>Main content</div>,
    subheader: <div>Subheader slot</div>,
    footer: <div>Footer slot</div>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Main content")).toBeInTheDocument();
    await expect(canvas.getByText("Subheader slot")).toBeInTheDocument();
    await expect(canvas.getByText("Footer slot")).toBeInTheDocument();
  },
};

/**
 * `measure="aligned"` holds the subheader and the content to one column of
 * readable width, starting both at the page's gutter. The play test checks
 * that the two share their left and right edges.
 */
export const AlignedMeasure: Story = {
  args: {
    measure: "aligned",
    subheader: <div data-testid="subheader">Breadcrumb and title</div>,
    content: <div data-testid="content">Page content</div>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const subheader = canvas.getByTestId("subheader").getBoundingClientRect();
    const content = canvas.getByTestId("content").getBoundingClientRect();

    await expect(Math.abs(subheader.left - content.left)).toBeLessThan(2);
    await expect(Math.abs(subheader.right - content.right)).toBeLessThan(2);
  },
};
