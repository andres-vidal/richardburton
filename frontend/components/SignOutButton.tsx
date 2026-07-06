import ExitIcon from "assets/exit.svg";
import HTTP from "modules/http";
import { FC } from "react";
import Button from "./Button";

const api = HTTP.client({ baseURL: process.env.NEXT_PUBLIC_API_URL });

const SignOutButton: FC = () => {
  const handleClick = async () => {
    // Revoke the rb-session server-side, then reload into a clean signed-out app.
    await api.delete("/sessions").catch(() => undefined);
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
