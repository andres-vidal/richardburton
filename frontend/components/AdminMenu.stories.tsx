import type { Meta, StoryObj } from "@storybook/react";
import { SessionProvider } from "modules/session";
import type { UserRole } from "modules/users";
import { ReactElement } from "react";
import { expect, within } from "storybook/test";

import AdminMenu from "./AdminMenu";

/** A decorator that signs in as `role` and gives the menu a white page. */
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

const meta = {
  title: "Admin/Admin menu",
  component: AdminMenu,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AdminMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Signed in as an admin, every tool has a card. The play test checks that the
 * cards link to their routes.
 */
export const Default: Story = {
  decorators: [signedInAs("admin")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("link", { name: /Add publications/ }),
    ).toHaveAttribute("href", "/en/admin/publications/documents");

    await expect(
      canvas.getByRole("link", { name: /Backfill sources/ }),
    ).toHaveAttribute("href", "/en/admin/publications/sources");

    await expect(canvas.getByRole("link", { name: /History/ })).toHaveAttribute(
      "href",
      "/en/admin/publications/history",
    );

    await expect(
      canvas.getByRole("link", { name: /Deleted publications/ }),
    ).toHaveAttribute("href", "/en/admin/publications/deleted");

    await expect(canvas.getByRole("link", { name: /Access/ })).toHaveAttribute(
      "href",
      "/en/admin/users",
    );
  },
};

/**
 * Signed in as a contributor, every tool but Access has a card. The play test
 * checks that Access is missing.
 */
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
