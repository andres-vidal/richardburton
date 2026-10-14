"use client";

import GoogleIcon from "assets/google.svg";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Button from "./Button";

type Props = {
  /** Replaces the plain offer to sign in, for a page that says why it asks. */
  label?: string;
  /** Centres the icon and label in the button instead of aligning them left. */
  centered?: boolean;
};

/**
 * An outline button with the Google logo that starts signing in with Google.
 * It loads the `/api/auth/google` route handler as a whole page, since the
 * handler answers with a redirect to Google that the client router cannot
 * follow.
 */
const SignInButton: FC<Props> = ({ label, centered = false }) => {
  const t = useTranslations("auth");

  const handleClick = () => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/api/auth/google");
  };

  return (
    <Button
      label={label ?? t("googleButton")}
      variant="outline"
      alignment={centered ? "center" : "left"}
      onClick={handleClick}
      Icon={GoogleIcon}
      width="fixed"
    />
  );
};

export default SignInButton;
