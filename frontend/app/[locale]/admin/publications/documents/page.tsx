import Breadcrumb from "components/Breadcrumb";
import DocumentList from "components/DocumentList";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import { getTranslations } from "next-intl/server";

import { readDocuments } from "app/documents/read";
import { admitEditors } from "../../guard";

/**
 * Lists the import documents that are not archived, or with `?archived=true`
 * the archived ones.
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  await admitEditors();

  const archived = (await searchParams).archived === "true";

  const [t, admin, first] = await Promise.all([
    getTranslations("documents"),
    getTranslations("admin"),
    readDocuments(archived),
  ]);

  const crumbs = [
    { label: admin("home"), href: "/" },
    { label: admin("admin"), href: "/admin" },
    { label: t("title") },
  ];

  const side = archived ? "archived" : "current";

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={crumbs} />
          <PageHeader title={t("title")} description={t("description")} />
        </>
      }
      // `key` is the side, so switching between current and archived remounts
      // `DocumentList`. Its state then starts from the new `first` instead of
      // keeping the pages loaded for the other side.
      content={<DocumentList key={side} side={side} first={first} />}
    />
  );
}
