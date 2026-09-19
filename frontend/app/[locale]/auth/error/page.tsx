import AuthCard from "components/AuthCard";
import Layout from "components/Layout";
import SignInButton from "components/SignInButton";
import { SESSION_COOKIE } from "modules/api";
import type { Metadata } from "next";
import { cookies } from "next/headers";
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
  // An authenticated user has no reason to be on the error page — redirect home
  // server-side (no flash, no client effect). Check the rb-session cookie's
  // presence rather than importing the server auth instance, which would run its
  // boot-time invariants during `next build`, where the secrets aren't set.
  if ((await cookies()).get(SESSION_COOKIE)) {
    redirect({ href: "/", locale: await getLocale() });
  }

  const t = await getTranslations("auth");
  const errors = await getTranslations("auth.errors");
  const { error } = await searchParams;

  // The provider names the error and the catalogue is keyed by that name, so
  // there is nothing in between to keep in step. One it has no words for is
  // told as the general failure, and one it has no way out of says none.
  const named = error && (errors.has(`${error}.title`) ? error : "Default");

  const description = named && {
    title: errors(`${named}.title`),
    message: errors(`${named}.message`),
    suggestion: errors.has(`${named}.suggestion`)
      ? errors(`${named}.suggestion`)
      : undefined,
  };

  return (
    <Layout
      content={
        description ? (
          <AuthCard
            title={description.title}
            action={<SignInButton label={t("tryAgain")} centered />}
          >
            <p className="text-lg">{description.message}</p>
            {description.suggestion && (
              <p className="text-sm">{description.suggestion}</p>
            )}
          </AuthCard>
        ) : null
      }
    />
  );
}
