"use client";

import { ROLES } from "modules/users";
import { useTranslations } from "next-intl";
import { FC } from "react";

const signInAs = (role: (typeof ROLES)[number]) => {
  // The route handler answers with a redirect, so the client router cannot follow it.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/api/auth/dev?role=${role}`);
};

// Dev-only credentials shortcut, one per role. Navigates to the `/api/auth/dev`
// route handler (a full navigation, not a client-side <Link>, so its Set-Cookie
// reaches the browser), which mints a session for that role and sends it where a
// real sign-in would — including turning back a role the gate does not admit.
// Rendered only in development — see the sign-in page.
//
// A button each, because what an admin can reach and what a contributor can is
// the difference worth being able to look at. Each role has its own account, so
// signing in as one does not demote the other.
const DevSignInButton: FC = () => {
  const t = useTranslations("admin");
  const roleName = useTranslations("roles");

  return (
    <span className="flex gap-3 items-baseline text-sm text-gray-600">
      <span>{t("devSignIn")}</span>
      {ROLES.map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => signInAs(role)}
          className="rounded underline hover:text-indigo-600 focus-ring"
        >
          {roleName(role)}
        </button>
      ))}
    </span>
  );
};

export default DevSignInButton;
