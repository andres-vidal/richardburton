import GoogleIcon from "assets/google.svg";
import { authClient } from "lib/auth-client";
import { FC } from "react";
import Button from "./Button";

const SignInButton: FC = () => {
  return (
    <Button
      label="Sign in"
      variant="outline"
      alignment="left"
      onClick={() =>
        authClient.signIn.social({ provider: "google", callbackURL: "/" })
      }
      Icon={GoogleIcon}
      width="fixed"
    />
  );
};

export default SignInButton;
