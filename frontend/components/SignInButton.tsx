"use client";

import GoogleIcon from "assets/google.svg";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Button from "./Button";

type Props = {
  next?: string;
  label?: string;
};

const SignInButton: FC<Props> = ({ next = "/", label }) => {
  const t = useTranslations();

  const handleClick = () => {
    window.location.assign(`/api/auth/google?next=${encodeURIComponent(next)}`);
  };

  return (
    <Button
      label={label ?? t("auth.signIn.withGoogle")}
      variant="outline"
      alignment="left"
      onClick={handleClick}
      Icon={GoogleIcon}
      width="fixed"
    />
  );
};

export default SignInButton;