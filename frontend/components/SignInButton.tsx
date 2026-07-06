import GoogleIcon from "assets/google.svg";
import { FC } from "react";
import Button from "./Button";

type Props = {
  next?: string;
};

const SignInButton: FC<Props> = ({ next = "/" }) => {
  const handleClick = () => {
    window.location.assign(`/api/auth/google?next=${encodeURIComponent(next)}`);
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
