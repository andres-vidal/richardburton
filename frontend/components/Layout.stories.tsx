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

/**
 * Signed in, the header offers the way out. It is the one control that has to
 * be on every page, and the header is the only thing every page has.
 */
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

/** Signed out, there is nothing to leave. */
export const SignedOut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Sign out" })).toBeNull();
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

/**
 * `measure="aligned"` holds the subheader and the content to one column of
 * readable width, starting both at the page's gutter — where the header's own
 * content begins. Without it a narrow page reads as misaligned: the heading sits
 * at the viewport edge while the content floats in the middle.
 */
export const AlignedMeasure: Story = {
  args: {
    measure: "aligned",
    subheader: <div data-testid="subheader">Breadcrumb and title</div>,
    content: <div data-testid="content">Page content</div>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Both regions share a left edge — that is the whole point of the measure.
    const subheader = canvas.getByTestId("subheader").getBoundingClientRect();
    const content = canvas.getByTestId("content").getBoundingClientRect();

    await expect(Math.abs(subheader.left - content.left)).toBeLessThan(2);
    await expect(Math.abs(subheader.right - content.right)).toBeLessThan(2);
  },
};
