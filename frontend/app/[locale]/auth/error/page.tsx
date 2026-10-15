import AuthCard from "components/AuthCard";
import Layout from "components/Layout";
import SignInButton from "components/SignInButton";
import { getSession } from "app/session";
import type { Metadata } from "next";
import { redirect } from "i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";

/** Returns the page's title. */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("errorTitle") };
}

/**
 * The page a failed sign-in lands on. It explains the error that `?error`
 * names, or gives the `Default` explanation when the catalogue has none for
 * it, and offers to sign in again. It redirects a signed-in user to the index.
 */
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) {
    redirect({ href: "/", locale: await getLocale() });
  }

  const [t, errors, { error }] = await Promise.all([
    getTranslations("auth"),
    getTranslations("auth.errors"),
    searchParams,
  ]);

  const named = error && errors.has(`${error}.title`) ? error : "Default";

  return (
    <Layout
      content={
        <AuthCard copy={`auth.errors.${named}`}>
          <SignInButton label={t("tryAgain")} centered />
        </AuthCard>
      }
    />
  );
}
