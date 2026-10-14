import AuthCard from "components/AuthCard";
import Layout from "components/Layout";
import { Link } from "i18n/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/** Returns the page's title. */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("notFound"))("title") };
}

/**
 * The 404 page of an address under a locale that no route answers, and of a
 * page under a locale that calls `notFound()`. It says there is no such page
 * and links to the index.
 *
 * It renders inside the locale layout, which writes `<html>` and `<body>`. The
 * root layout writes neither, so Next's own 404, which renders under the root
 * layout, would arrive with no document around it.
 */
export default async function NotFoundPage() {
  const t = await getTranslations("notFound");

  return (
    <Layout
      content={
        <AuthCard copy="notFound">
          <Link href="/" className="anchor">
            {t("browse")}
          </Link>
        </AuthCard>
      }
    />
  );
}
