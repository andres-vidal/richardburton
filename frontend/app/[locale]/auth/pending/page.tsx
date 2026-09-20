import AuthCard from "components/AuthCard";
import Layout from "components/Layout";
import type { Metadata } from "next";
import { Link } from "i18n/navigation";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("pendingPageTitle") };
}

/**
 * Where someone lands when the sign-in worked and there is nothing yet to do
 * with it.
 *
 * An account exists, but with a reader's role, which grants nothing signing out
 * would not. "Access denied" would be wrong twice over: nothing was denied, and
 * asking is a way forward.
 *
 * The page names nobody — the session cookie is relayed only once the gate
 * passes, so there is no session to read yet.
 */
export default async function AccessPendingPage() {
  const t = await getTranslations("auth");

  return (
    <Layout
      content={
        <AuthCard copy="auth.pending">
          <Link href="/" className="anchor">
            {t("pendingBrowse")}
          </Link>
        </AuthCard>
      }
    />
  );
}
