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

type ErrorCode = "AccessDenied" | "Verification" | "Default" | "Configuration";
/** What each error is called in the catalogue, and whether it suggests a way out. */
const ERROR_MESSAGES: Record<ErrorCode, { key: string; suggests?: true }> = {
  AccessDenied: { key: "accessDenied", suggests: true },
  Verification: { key: "verification" },
  Configuration: { key: "configuration" },
  Default: { key: "default" },
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
    redirect({ href: "/", locale: await getLocale() });
  }

  const t = await getTranslations("auth");
  const { error } = await searchParams;
  const described = error
    ? (ERROR_MESSAGES[error as ErrorCode] ?? ERROR_MESSAGES.Default)
    : null;
  const description = described && {
    title: t(`${described.key}Title`),
    message: t(`${described.key}Message`),
    suggestion: described.suggests
      ? t(`${described.key}Suggestion`)
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
