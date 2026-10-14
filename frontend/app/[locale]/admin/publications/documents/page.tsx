import AdminPage from "components/AdminPage";
import DocumentList from "components/DocumentList";
import { getTranslations } from "next-intl/server";

import { readDocuments } from "app/documents/read";
import { admitEditors } from "../../guard";

/**
 * Lists the import documents that are not archived, or with `?archived=true`
 * the archived ones.
 *
 * `DocumentList` is keyed by the side, so switching between current and
 * archived remounts it. Its state then starts from the new `first` instead of
 * keeping the pages loaded for the other side.
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  await admitEditors();

  const archived = (await searchParams).archived === "true";

  const [t, first] = await Promise.all([
    getTranslations("documents"),
    readDocuments(archived),
  ]);

  const side = archived ? "archived" : "current";

  return (
    <AdminPage
      title={t("title")}
      description={t("description")}
      content={<DocumentList key={side} side={side} first={first} />}
    />
  );
}
