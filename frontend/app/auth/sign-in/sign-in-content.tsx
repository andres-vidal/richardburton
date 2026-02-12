"use client";

import { authClient } from "lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = authClient.useSession();
  const isAuthenticated = !!session.data;
  const isLoading = session.isPending;

  useEffect(() => {
    if (isAuthenticated) {
      const callbackUrl = searchParams.get("callbackUrl") || "/";
      router.push(callbackUrl);
    } else if (!isLoading) {
      authClient.signIn.social({ provider: "google", callbackURL: "/" });
    }
  }, [router, searchParams, isAuthenticated, isLoading]);

  return null;
}
