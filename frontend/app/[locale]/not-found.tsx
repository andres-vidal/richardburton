import AuthCard from "components/AuthCard";
import Layout from "components/Layout";
import { Link } from "i18n/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("notFound"))("title") };
}

/**
 * What a URL under a locale shows when nothing answers it, and what
 * `notFound()` raises to anywhere in the locale tree.
 *
 * It renders inside the locale layout, which is where `<html>` and `<body>` are
 * written. Without it Next falls back to its own 404, which renders under the
 * root layout — and that one only passes its children through, so the page
 * arrives with no document around it.
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
