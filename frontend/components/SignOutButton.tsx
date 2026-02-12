import ExitIcon from "assets/exit.svg";
import { authClient } from "lib/auth-client";
import { FC } from "react";
import Button from "./Button";

const SignOutButton: FC = () => {
  return (
    <Button
      label="Sign out"
      variant="outline"
      alignment="left"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/";
      }}
      Icon={ExitIcon}
      width="fixed"
    />
  );
};

export default SignOutButton;
