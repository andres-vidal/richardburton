import ExitIcon from "assets/exit.svg";
import { authClient } from "modules/authClient";
import HTTP from "modules/http";
import { FC } from "react";
import Button from "./Button";

const api = HTTP.client({ baseURL: process.env.NEXT_PUBLIC_API_URL });

const SignOutButton: FC = () => {
  const handleClick = async () => {
    await Promise.allSettled([api.delete("/sessions"), authClient.signOut()]);
    window.location.replace("/");
  };

  return (
    <Button
      label="Sign out"
      variant="outline"
      alignment="left"
      onClick={handleClick}
      Icon={ExitIcon}
      width="fixed"
    />
  );
};

export default SignOutButton;
