import BulkWorkspace from "components/BulkWorkspace";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { readDocument } from "app/documents/read";
import { admitEditors } from "../../../guard";

/**
 * One import document, under its name.
 *
 * The name belongs to the server rather than to the content, so it is read
 * here with the page rather than restored with the rows.
 */
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await admitEditors();

  const { id } = await params;
  const [t, document] = await Promise.all([
    getTranslations("documents"),
    readDocument(id),
  ]);

  return document ? (
    <BulkWorkspace
      title={document.name}
      description={t("description")}
      document={document.id}
    />
  ) : (
    notFound()
  );
}
