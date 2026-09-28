import { request } from "app";
import { fromBase64, toBase64 } from "lib0/buffer";
import * as Y from "yjs";

/** An import document as the list of them shows it. */
type DocumentSummary = {
  id: number;
  name: string;
  /**
   * How many rows it holds. The server does not read the content, so this is
   * whatever the client last counted while writing to it.
   */
  rows: number;
  /** When it was taken off the list, or null while it is still on it. */
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
 * Where a page of the list starts: the last document of the page before it.
 *
 * The list is read from a position rather than by skipping a count, so a
 * document changed between two reads, which moves it to the top, neither
 * appears twice nor pushes another out of sight.
 */
type Cursor = Pick<DocumentSummary, "id" | "updatedAt">;

/**
 * Everything needed to rebuild a document's content, and how far it reaches.
 *
 * `through` is the id of the last update the read includes. A compaction names
 * it, so that whatever was appended while the merge was being made is left
 * alone rather than swept up with what the merge replaces.
 */
type Held = {
  updates: Uint8Array[];
  through: number;
};

/**
 * Updates cross as base64, since the rest of this API speaks JSON.
 *
 * They are opaque on both sides of the wire: the server appends them and hands
 * them back without parsing one, which is what keeps a native Yjs dependency
 * out of the deployment. The codec is the one Yjs itself uses, which handles a
 * whole document at once — compacting encodes exactly that.
 */
const encode = (update: Uint8Array): string => toBase64(update);

const decode = (update: string): Uint8Array => fromBase64(update);

/**
 * A page of the import documents, from the side of the list asked for, starting
 * after `after` where one is given. The list is shared, so this is not scoped to
 * anyone.
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
 * Take a document off the list, keeping what it holds.
 *
 * Archiving rather than deleting: the rows are a record of what was prepared,
 * and one taken off the list can be put back.
 */
async function archive(id: number): Promise<DocumentSummary> {
  return request(async (http) => {
    const { data } = await http.delete<DocumentSummary>(`documents/${id}`);

    return data;
  });
}

/** Put an archived document back on the list. */
async function unarchive(id: number): Promise<DocumentSummary> {
  return request(async (http) => {
    const { data } = await http.post<DocumentSummary>(
      `documents/${id}/restore`,
    );

    return data;
  });
}

/**
 * Everything needed to rebuild the content, and how far the read reaches.
 *
 * With `after`, only what was written after that point is read, for a reader
 * that already holds everything up to it.
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

/** Append one change, with the row count counted while making it. */
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
 * Write one merged update in place of every update up to `through`.
 *
 * Only a client can do this, because only a client reads the content. The
 * merged update is the whole of what this client holds, encoded as one, and
 * `through` is how far the read it merged from reached — anything appended past
 * that point is not this merge's to replace.
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
