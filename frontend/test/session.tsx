import type { Decorator } from "@storybook/react";
import { SessionProvider } from "modules/session";

/** The session of an admin. */
const ADMIN = { email: "admin@rb.test", role: "admin" as const };

/**
 * A story decorator that renders the story signed in as `ADMIN`. A component
 * that shows admin controls only to an admin reads the role from the session,
 * so a story signs in to show them rather than passing a prop.
 */
const asAdmin: Decorator = (Story) => (
  <SessionProvider session={ADMIN}>
    <Story />
  </SessionProvider>
);

export { asAdmin };
