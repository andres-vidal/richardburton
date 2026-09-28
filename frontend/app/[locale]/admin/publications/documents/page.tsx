import Breadcrumb from "components/Breadcrumb";
import DocumentList from "components/DocumentList";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import { getTranslations } from "next-intl/server";

import { readDocuments } from "app/documents/read";
import { admitEditors } from "../../guard";

/**
 * The import documents, one side of the list at a time: the ones on offer, or
 * with `?archived=true` the ones taken off the list.
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
      // A side of the list is its own page, so the one being left takes what
      // it had read with it.
      content={<DocumentList key={side} side={side} first={first} />}
    />
  );
}
