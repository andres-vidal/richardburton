import GoogleIcon from "assets/google.svg";
import { signIn } from "next-auth/react";
import { FC } from "react";
import Button from "./Button";

const SignInButton: FC<{ callbackUrl?: string }> = ({
  callbackUrl = "/api/session",
}) => {
  return (
    <Button
      label="Sign in with Google"
      variant="outline"
      alignment="left"
      onClick={() => signIn("google", { callbackUrl })}
      Icon={GoogleIcon}
      width="fixed"
    />
  );
};

export default SignInButton;
