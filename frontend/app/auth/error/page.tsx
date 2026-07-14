import Layout from "components/Layout";
import SignInButton from "components/SignInButton";
import { SESSION_COOKIE } from "modules/api";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Error" };

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

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // An authenticated user has no reason to be on the error page — redirect home
  // server-side (no flash, no client effect). Check the rb-session cookie's
  // presence rather than importing the server auth instance, which would run its
  // boot-time invariants during `next build`, where the secrets aren't set.
  if ((await cookies()).get(SESSION_COOKIE)) {
    redirect("/");
  }

  const { error } = await searchParams;
  const description = error
    ? ERROR_DESCRIPTIONS[error as ErrorCode] ?? ERROR_DESCRIPTIONS.Default
    : null;

  return (
    <Layout
      content={
        description ? (
          <div className="flex justify-center items-center py-32 w-full">
            <section className="flex flex-col justify-between p-7 w-96 text-center rounded shadow aspect-square">
              <h1 className="text-2xl">{description.title}</h1>
              <div className="space-y-4">
                <p className="text-lg">{description.message}</p>
                {description.suggestion && (
                  <p className="text-sm">{description.suggestion}</p>
                )}
              </div>
              <SignInButton label="Try again" />
            </section>
          </div>
        ) : null
      }
    />
  );
}
