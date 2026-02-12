import { Suspense } from "react";
import AuthErrorContent from "./error-content";

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  );
}
