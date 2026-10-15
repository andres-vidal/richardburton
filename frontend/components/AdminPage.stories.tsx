import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";

import AdminPage from "./AdminPage";
import Button from "./Button";

const meta = {
  title: "Admin/Admin page",
  component: AdminPage,
  args: {
    title: "History",
    description: "Every change to the database, who made it, and when.",
    content: <p>Page content</p>,
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AdminPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The breadcrumb leads from the home page through the admin index to the page,
 * whose title is the last crumb and the heading. The play test checks the
 * crumbs, the heading and the content.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const breadcrumb = within(
      canvas.getByRole("navigation", { name: "Breadcrumb" }),
    );

    await expect(
      breadcrumb.getByRole("link", { name: "Home" }),
    ).toHaveAttribute("href", "/en");
    await expect(
      breadcrumb.getByRole("link", { name: "Admin" }),
    ).toHaveAttribute("href", "/en/admin");
    await expect(breadcrumb.getByText("History")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      canvas.getByRole("heading", { level: 1, name: "History" }),
    ).toBeVisible();
    await expect(
      canvas.getByText("Every change to the database, who made it, and when."),
    ).toBeVisible();
    await expect(canvas.getByRole("main")).toHaveTextContent("Page content");
  },
};

/**
 * `measure="aligned"` holds the heading and the content to one column of
 * readable width, as `Layout` does. The play test checks that the measure
 * reaches the layout's main element.
 */
export const Aligned: Story = {
  args: { measure: "aligned" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("main")).toHaveAttribute(
      "data-measure",
      "aligned",
    );
  },
};

/**
 * `aside` is shown at the end of the heading's row, and `footer` in the sticky
 * footer under the content.
 */
export const AsideAndFooter: Story = {
  args: {
    title: "Spring catalogue",
    description: "Prepare new publications to be inserted in the database.",
    aside: <span>Saved</span>,
    footer: <Button label="Submit" width="fit" />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas
      .getByRole("heading", { level: 1, name: "Spring catalogue" })
      .getBoundingClientRect();
    const aside = canvas.getByText("Saved").getBoundingClientRect();

    await expect(aside.left).toBeGreaterThan(heading.right);
    await expect(
      within(canvas.getByRole("contentinfo")).getByRole("button", {
        name: "Submit",
      }),
    ).toBeVisible();
  },
};
