import { Suspense } from "react";
import SignInContent from "./sign-in-content";

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
