import { request } from "app";
import * as Y from "yjs";

/** A workspace as the list of them shows it. */
type WorkspaceSummary = {
  id: number;
  name: string;
  /**
   * How many rows it holds. The server does not read the document, so this is
   * whatever the client last counted while writing to it.
   */
  rows: number;
  insertedAt: string;
  updatedAt: string;
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

async function list(): Promise<WorkspaceSummary[]> {
  return request(async (http) => {
    const { data } = await http.get<{ entries: WorkspaceSummary[] }>(
      "workspaces",
    );

    return data.entries;
  });
}

async function create(name: string): Promise<WorkspaceSummary> {
  return request(async (http) => {
    const { data } = await http.post<WorkspaceSummary>("workspaces", { name });

    return data;
  });
}

/** Everything needed to rebuild the document, oldest first. */
async function updates(id: number): Promise<Uint8Array[]> {
  return request(async (http) => {
    const { data } = await http.get<{ entries: string[] }>(
      `workspaces/${id}/updates`,
    );

    return data.entries.map(decode);
  });
}

/** Append one change, with the row count counted while making it. */
async function append(
  id: number,
  update: Uint8Array,
  rows: number,
): Promise<void> {
  return request(async (http) => {
    await http.post(`workspaces/${id}/updates`, {
      update: encode(update),
      rows,
    });
  });
}

/**
 * Replace the workspace's updates with one that means the same thing.
 *
 * Only a client can do this, because only a client reads the document. The
 * merged update is the whole of it, encoded as one.
 */
async function compact(id: number, doc: Y.Doc): Promise<void> {
  return request(async (http) => {
    await http.post(`workspaces/${id}/compact`, {
      update: encode(Y.encodeStateAsUpdate(doc)),
    });
  });
}

/** Let someone else open this workspace, by the address they signed in with. */
async function addMember(id: number, email: string): Promise<void> {
  return request(async (http) => {
    await http.post(`workspaces/${id}/members`, { email });
  });
}

export { addMember, append, compact, create, decode, encode, list, updates };
export type { WorkspaceSummary };
