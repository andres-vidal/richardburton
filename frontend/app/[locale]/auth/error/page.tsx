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
  // told as the general failure.
  const named = error && (errors.has(`${error}.title`) ? error : "Default");

  return (
    <Layout
      content={
        named ? (
          <AuthCard
            title={errors(`${named}.title`)}
            action={<SignInButton label={t("tryAgain")} centered />}
          >
            {/* What the card says is the message's own shape: an error with no
                way out of it names no suggestion, so none is rendered. */}
            {errors.rich(`${named}.body`, {
              message: (chunks) => <p className="text-lg">{chunks}</p>,
              suggestion: (chunks) => <p className="text-sm">{chunks}</p>,
            })}
          </AuthCard>
        ) : null
      }
    />
  );
}
