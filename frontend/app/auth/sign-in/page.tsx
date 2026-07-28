import AuthCard from "components/AuthCard";
import DevSignInButton from "components/DevSignInButton";
import Layout from "components/Layout";
import SignInButton from "components/SignInButton";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

  // Route sign-in errors (e.g. OAuthCallback) to the shared error page, so all
  // auth errors follow the same pattern — see app/auth/error.
  if (error) {
    redirect(`/auth/error?error=${encodeURIComponent(error)}`);
  }

  const next = callbackUrl ?? "/";

  return (
    <Layout
      content={
        <AuthCard
          title="Sign in"
          action={
            <div className="flex flex-col gap-3 items-center">
              <SignInButton next={next} />
              {process.env.NODE_ENV === "development" && <DevSignInButton />}
            </div>
          }
        >
          <p className="text-lg">
            Sign in with your Google account to access the platform.
          </p>
        </AuthCard>
      }
    />
  );
}
