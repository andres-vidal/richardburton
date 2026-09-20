import AuthCard from "components/AuthCard";
import DevSignInButton from "components/DevSignInButton";
import Layout from "components/Layout";
import SignInButton from "components/SignInButton";
import type { Metadata } from "next";
import { redirect } from "i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("signIn.title") };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

  // Route sign-in errors (e.g. OAuthCallback) to the shared error page, so all
  // auth errors follow the same pattern — see app/auth/error.
  if (error) {
    redirect({
      href: `/auth/error?error=${encodeURIComponent(error)}`,
      locale: await getLocale(),
    });
  }

  const next = callbackUrl ?? "/";

  return (
    <Layout
      content={
        <AuthCard copy="auth.signIn">
          <div className="flex flex-col gap-3 items-center">
            <SignInButton next={next} />
            {process.env.NODE_ENV === "development" && <DevSignInButton />}
          </div>
        </AuthCard>
      }
    />
  );
}
