"use client";

import GoogleIcon from "assets/google.svg";
import { FC } from "react";
import Button from "./Button";

type Props = {
  next?: string;
  label?: string;
  centered?: boolean;
};

const SignInButton: FC<Props> = ({
  next = "/",
  label = "Sign in with Google",
  centered = false,
}) => {
  const handleClick = () => {
    // A whole-page navigation, not the router: this is a route handler that
    // answers with a redirect to Google, not a page the client router can render.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/auth/google?next=${encodeURIComponent(next)}`);
  };

  return (
    <Button
      label={label}
      variant="outline"
      alignment={centered ? "center" : "left"}
      onClick={handleClick}
      Icon={GoogleIcon}
      width="fixed"
    />
  );
};

export default SignInButton;
