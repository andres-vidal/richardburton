"use client";

import { FC } from "react";

// Dev-only credentials shortcut. Navigates to the `/api/auth/dev` route handler
// (a full navigation, not a client-side <Link>, so its Set-Cookie reaches the
// browser), which mints an admin session and redirects home. Rendered only in
// development — see the sign-in page.
const DevSignInButton: FC = () => (
  <button
    type="button"
    onClick={() => window.location.assign("/api/auth/dev")}
    className="text-sm text-gray-500 underline hover:text-indigo-600"
  >
    Dev admin sign-in
  </button>
);

export default DevSignInButton;
