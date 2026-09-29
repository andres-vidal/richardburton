import BulkWorkspace from "components/BulkWorkspace";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { readDocument } from "app/documents/read";
import { admitEditors } from "../../../guard";

/**
 * Renders one import document in a `BulkWorkspace` titled with its name, or a
 * 404 when there is no such document.
 *
 * The name is stored in the server's document record, not in the Yjs content,
 * so this page reads it with `readDocument` rather than from the rows.
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
