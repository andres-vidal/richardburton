import AuthCard from "components/AuthCard";
import Layout from "components/Layout";
import SignInButton from "components/SignInButton";
import { getSession } from "app/session";
import type { Metadata } from "next";
import { redirect } from "i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("errorTitle") };
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // A signed-in user is sent to the home page.
  if (await getSession()) {
    redirect({ href: "/", locale: await getLocale() });
  }

  const t = await getTranslations("auth");
  const errors = await getTranslations("auth.errors");
  const { error } = await searchParams;

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
