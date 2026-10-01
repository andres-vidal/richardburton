import { get } from "app/api";
import {
  DOCUMENTS_PER_PAGE,
  type DocumentPage,
  type DocumentSummary,
} from "modules/publication/document-remote";

/**
 * Reads the first page of import documents as the signed-in user: the ones
 * that are not archived, or with `archived` the archived ones.
 */
export async function readDocuments(archived: boolean): Promise<DocumentPage> {
  return get<DocumentPage>("/documents", {
    limit: DOCUMENTS_PER_PAGE,
    archived,
  });
}

/**
 * Reads one import document. Returns `null` when the read fails, for example
 * when there is no such document. Archived documents are returned too, so a
 * link to one still works.
 */
export async function readDocument(
  id: string,
): Promise<DocumentSummary | null> {
  return get<DocumentSummary>(`/documents/${id}`).catch(() => null);
}
