import type { Meta, StoryObj } from "@storybook/react";
import { SessionProvider } from "modules/session";
import type { UserRole } from "modules/users";
import { ReactElement } from "react";
import { expect, within } from "storybook/test";

import AdminMenu from "./AdminMenu";

const signedInAs = (role: UserRole) =>
  function SignedIn(Story: () => ReactElement) {
    return (
      <SessionProvider session={{ email: "me@rb.test", role }}>
        <div className="p-8 min-h-screen bg-white">
          <Story />
        </div>
      </SessionProvider>
    );
  };

// The admin hub: a card per admin tool. Linked from the home footer so admin
// actions live on one page instead of cluttering the footer.
const meta = {
  title: "Admin/Admin menu",
  component: AdminMenu,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AdminMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Each tool is a card linking to its route. */
export const Default: Story = {
  decorators: [signedInAs("admin")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("link", { name: /Add publications/ }),
    ).toHaveAttribute("href", "/admin/publications/new");

    await expect(
      canvas.getByRole("link", { name: /Backfill references/ }),
    ).toHaveAttribute("href", "/admin/publications/references");

    await expect(canvas.getByRole("link", { name: /History/ })).toHaveAttribute(
      "href",
      "/admin/publications/history",
    );

    await expect(
      canvas.getByRole("link", { name: /Deleted publications/ }),
    ).toHaveAttribute("href", "/admin/publications/deleted");

    await expect(canvas.getByRole("link", { name: /Access/ })).toHaveAttribute(
      "href",
      "/admin/users",
    );
  },
};

/** The catalogue is a contributor's; deciding who may work on it is not. */
export const AsAContributor: Story = {
  decorators: [signedInAs("contributor")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("link", { name: /Add publications/ }),
    ).toBeVisible();
    await expect(canvas.queryByRole("link", { name: /Access/ })).toBeNull();
  },
};
