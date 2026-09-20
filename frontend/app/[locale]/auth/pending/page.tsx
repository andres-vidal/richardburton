import AuthCard, { AUTH_CARD_BODY } from "components/AuthCard";
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
 * They were invited, so an account exists, but it holds a reader's role, which
 * carries nothing they could not already do signed out. "Access denied" would
 * be twice wrong: they were not denied, and there is something they can do
 * about it, which is ask.
 *
 * It says nothing about who they are, because it cannot: the session cookie is
 * relayed only once the gate passes, so at this point there is no session to
 * read.
 */
export default async function AccessPendingPage() {
  const t = await getTranslations("auth");

  return (
    <Layout
      content={
        <AuthCard
          title={t("pendingTitle")}
          action={
            <Link href="/" className="anchor">
              {t("pendingBrowse")}
            </Link>
          }
        >
          {t.rich("pendingBody", AUTH_CARD_BODY)}
        </AuthCard>
      }
    />
  );
}
