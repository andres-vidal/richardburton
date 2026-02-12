"use client";

import GoogleIcon from "assets/google.svg";
import Button from "components/Button";
import Layout from "components/Layout";
import { authClient } from "lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

type ErrorCode = "AccessDenied" | "Verification" | "Default" | "Configuration";
type ErrorDescription = { title: string; message: string; suggestion?: string };

const ERROR_DESCRIPTIONS: Record<ErrorCode, ErrorDescription> = {
  AccessDenied: {
    title: "Access denied",
    message:
      "You are not allowed to sign into the app. Currently, only system administrators can access.",
    suggestion: "Please contact support if you think this could be a mistake.",
  },

  Verification: {
    title: "Verification error",
    message:
      "Seems like your token is expired or has already been used. Please contact support.",
  },

  Configuration: {
    title: "Configuration error",
    message:
      "Seems like the server is not configured correctly. Please contact support.",
  },

  Default: {
    title: "Something went wrong...",
    message:
      "Seems like the app is not working correctly. Please contact support.",
  },
};

export default function AuthErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const description =
    ERROR_DESCRIPTIONS[(error as ErrorCode) || "Default"] ??
    ERROR_DESCRIPTIONS.Default;

  const session = authClient.useSession();
  const isAuthenticated = !!session.data;

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [router, isAuthenticated]);

  return (
    <Layout
      title="Error"
      content={
        description ? (
          <div className="flex items-center justify-center w-full py-32">
            <section className="flex flex-col justify-between text-center rounded shadow p-7 w-96 aspect-square">
              <h1 className="text-2xl">{description.title}</h1>
              <div className="space-y-4 ">
                <p className="text-lg">{description.message}</p>
                {description.suggestion && (
                  <p className="text-sm">{description.suggestion}</p>
                )}
              </div>
              <Button
                label="Try again"
                variant="outline"
                onClick={() =>
                  authClient.signIn.social({
                    provider: "google",
                    callbackURL: "/",
                  })
                }
                Icon={GoogleIcon}
              />
            </section>
          </div>
        ) : null
      }
    />
  );
}
