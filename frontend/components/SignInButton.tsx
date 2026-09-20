"use client";

import GoogleIcon from "assets/google.svg";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Button from "./Button";

type Props = {
  next?: string;
  /** Overrides the plain offer, for a page that says why it is asking. */
  label?: string;
  centered?: boolean;
};

const SignInButton: FC<Props> = ({ next = "/", label, centered = false }) => {
  const t = useTranslations("auth");

  const handleClick = () => {
    // A whole-page navigation, not the router: this is a route handler that
    // answers with a redirect to Google, not a page the client router can render.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/auth/google?next=${encodeURIComponent(next)}`);
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
