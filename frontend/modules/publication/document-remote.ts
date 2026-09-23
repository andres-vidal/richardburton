import { request } from "app";
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

/** A page of the list, and how many documents there are in all. */
type DocumentPage = {
  entries: DocumentSummary[];
  total: number;
};

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
 * out of the deployment.
 */
const encode = (update: Uint8Array): string =>
  btoa(String.fromCharCode(...update));

const decode = (update: string): Uint8Array =>
  Uint8Array.from(atob(update), (character) => character.charCodeAt(0));

/**
 * A page of the import documents. The list is shared, so this is not scoped to
 * anyone; archived ones are left out.
 */
async function list(
  {
    limit,
    offset,
    archived,
  }: { limit?: number; offset?: number; archived?: boolean } = {},
  signal?: AbortSignal,
): Promise<DocumentPage> {
  return request(async (http) => {
    const { data } = await http.get<DocumentPage>("documents", {
      params: { limit, offset, archived },
      signal,
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

async function show(id: number): Promise<DocumentSummary> {
  return request(async (http) => {
    const { data } = await http.get<DocumentSummary>(`documents/${id}`);

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

/** Everything needed to rebuild the content, and how far the read reaches. */
async function updates(id: number): Promise<Held> {
  return request(async (http) => {
    const { data } = await http.get<{ entries: string[]; through: number }>(
      `documents/${id}/updates`,
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
  append,
  archive,
  compact,
  create,
  decode,
  encode,
  list,
  rename,
  show,
  unarchive,
  updates,
};
export type { DocumentPage, DocumentSummary, Held };
