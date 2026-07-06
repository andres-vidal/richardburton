import GoogleIcon from "assets/google.svg";
import { authClient } from "modules/authClient";
import { FC } from "react";
import Button from "./Button";

type Props = {
  callbackURL?: string;
};

const SignInButton: FC<Props> = ({ callbackURL = "/api/auth/bridge" }) => {
  const handleClick = () => {
    authClient.signIn.social({ provider: "google", callbackURL });
  };

  return (
    <Button
      label="Sign in with Google"
      variant="outline"
      alignment="left"
      onClick={handleClick}
      Icon={GoogleIcon}
      width="fixed"
    />
  );
};

export default SignInButton;
