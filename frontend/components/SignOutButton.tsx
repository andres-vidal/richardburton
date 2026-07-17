"use client";

import ExitIcon from "assets/exit.svg";
import HTTP from "modules/http";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Button from "./Button";

const api = HTTP.client({ baseURL: process.env.NEXT_PUBLIC_API_URL });

const SignOutButton: FC = () => {
  const t = useTranslations();

  const handleClick = async () => {
    // Revoke the rb-session server-side, then reload into a clean signed-out app.
    await api.delete("/sessions").catch(() => undefined);
    window.location.replace("/");
  };

  return (
    <Button
      label={t("auth.signOut.title")}
      variant="outline"
      alignment="left"
      onClick={handleClick}
      Icon={ExitIcon}
      width="fixed"
    />
  );
};

export default SignOutButton;