"use client";

import { ROLES } from "modules/users";
import { useTranslations } from "next-intl";
import { FC } from "react";

/**
 * Loads `/api/auth/dev` for `role` as a whole page, so the browser stores the
 * session cookie its redirect sets. The client router cannot follow a route
 * handler's redirect.
 */
const signInAs = (role: (typeof ROLES)[number]) => {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/api/auth/dev?role=${role}`);
};

/**
 * A button per role that signs in as that role without the Google handshake,
 * for development. Each button loads the `/api/auth/dev` route handler, which
 * starts a session for the role's own account and redirects where a real
 * sign-in would, turning back a role the sign-in gate does not admit.
 */
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
