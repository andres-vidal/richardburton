import { request } from "app";
import { fromBase64, toBase64 } from "lib0/buffer";
import * as Y from "yjs";

/** An import document's record from the server, without its content. */
type DocumentSummary = {
  id: number;
  name: string;
  /**
   * The number of rows in the document. The server does not parse the content,
   * so this is the count sent with the last `append`.
   */
  rows: number;
  /** When it was archived, or null when it is not archived. */
  archivedAt: string | null;
  insertedAt: string;
  updatedAt: string;
};

/** How many documents a page of the list holds. */
const DOCUMENTS_PER_PAGE = 20;

/** A page of the list, and whether more documents follow it. */
type DocumentPage = {
  entries: DocumentSummary[];
  more: boolean;
};

/**
 * Where a page of the list starts: the last document of the previous page.
 *
 * The list is ordered by `updatedAt`, newest first, and is read from a cursor
 * rather than an offset. A document that changes between two reads moves to
 * the top. With a cursor, that move does not make a document appear twice or
 * be skipped.
 */
type Cursor = Pick<DocumentSummary, "id" | "updatedAt">;

/**
 * A document's stored updates, and the id of the last one read.
 *
 * `compact` sends `through` back, so the server replaces only the updates up to
 * that id and keeps any update appended after the read.
 */
type Held = {
  updates: Uint8Array[];
  through: number;
};

/**
 * Encodes a Yjs update as base64 for the JSON API, and decodes it back.
 *
 * The server stores and returns updates without parsing them, so the backend
 * needs no native Yjs library. The codec is `lib0/buffer`, which Yjs itself
 * uses. It handles an update the size of a whole document, which is what
 * `compact` sends.
 */
const encode = (update: Uint8Array): string => toBase64(update);

const decode = (update: string): Uint8Array => fromBase64(update);

/**
 * Reads a page of import documents, archived or not, starting after the `after`
 * cursor when one is given. The list is shared, so the result is not filtered
 * by user.
 */
async function list({
  limit,
  archived,
  after,
}: {
  limit: number;
  archived: boolean;
  after?: Cursor;
}): Promise<DocumentPage> {
  return request(async (http) => {
    const { data } = await http.get<DocumentPage>("documents", {
      params: {
        limit,
        archived,
        after: after && { id: after.id, updatedAt: after.updatedAt },
      },
    });

    return data;
  });
}

async function create(name: string): Promise<DocumentSummary> {
  return request(async (http) => {
    const { data } = await http.post<DocumentSummary>("documents", { name });

    return data;
  });
}

/** Give a document a different name. */
async function rename(id: number, name: string): Promise<DocumentSummary> {
  return request(async (http) => {
    const { data } = await http.patch<DocumentSummary>(`documents/${id}`, {
      name,
    });

    return data;
  });
}

/**
 * Archives a document. Its content is kept, and `unarchive` can restore it.
 *
 * Documents are archived rather than deleted because their rows are a record
 * of what was prepared.
 */
async function archive(id: number): Promise<DocumentSummary> {
  return request(async (http) => {
    const { data } = await http.delete<DocumentSummary>(`documents/${id}`);

    return data;
  });
}

/** Restores an archived document. */
async function unarchive(id: number): Promise<DocumentSummary> {
  return request(async (http) => {
    const { data } = await http.post<DocumentSummary>(
      `documents/${id}/restore`,
    );

    return data;
  });
}

/**
 * Reads a document's stored updates and the id of the last one.
 *
 * With `after`, it reads only the updates stored after that id, for a reader
 * that already has the earlier ones.
 */
async function updates(id: number, after?: number): Promise<Held> {
  return request(async (http) => {
    const { data } = await http.get<{ entries: string[]; through: number }>(
      `documents/${id}/updates`,
      { params: { after } },
    );

    return { updates: data.entries.map(decode), through: data.through };
  });
}

/** Stores one update, with the document's current row count. */
async function append(
  id: number,
  update: Uint8Array,
  rows: number,
): Promise<void> {
  return request(async (http) => {
    await http.post(`documents/${id}/updates`, {
      update: encode(update),
      rows,
    });
  });
}

/**
 * Replaces every stored update up to `through` with one update that holds this
 * client's whole document.
 *
 * The client does this rather than the server, because only the client parses
 * the content. `through` is the id of the last update the client read, so
 * updates appended after that read are kept.
 */
async function compact(id: number, doc: Y.Doc, through: number): Promise<void> {
  return request(async (http) => {
    await http.post(`documents/${id}/compact`, {
      update: encode(Y.encodeStateAsUpdate(doc)),
      through,
    });
  });
}

export {
  DOCUMENTS_PER_PAGE,
  append,
  archive,
  compact,
  create,
  decode,
  encode,
  list,
  rename,
  unarchive,
  updates,
};
export type { Cursor, DocumentPage, DocumentSummary, Held };
