import AuthCard from "components/AuthCard";
import Layout from "components/Layout";
import type { Metadata } from "next";
import { Link } from "i18n/navigation";
import { getTranslations } from "next-intl/server";

/** Returns the page's title. */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("pendingPageTitle") };
}

/**
 * The page a sign-in lands on when the account exists but has only the
 * reader's role, which gives no access beyond what a visitor has. It says the
 * account is ready, that an admin can give it a role, and links to the index.
 *
 * It names nobody. The sign-in sets the session cookie only for a user who may
 * edit publications, so this page has no session to read.
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
