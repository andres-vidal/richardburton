import { get } from "app/api";
import {
  DOCUMENTS_PER_PAGE,
  type DocumentPage,
  type DocumentSummary,
} from "modules/publication/document-remote";

/**
 * The first page of one side of the list of import documents, read as the
 * signed-in user: the documents on offer, or with `archived` the ones taken off
 * the list.
 */
export async function readDocuments(archived: boolean): Promise<DocumentPage> {
  return get<DocumentPage>("/documents", {
    limit: DOCUMENTS_PER_PAGE,
    archived,
  });
}

/**
 * One import document, or `null` when there is no such document. An archived
 * document is still found, so a link to one does not break.
 */
export async function readDocument(
  id: string,
): Promise<DocumentSummary | null> {
  return get<DocumentSummary>(`/documents/${id}`).catch(() => null);
}
