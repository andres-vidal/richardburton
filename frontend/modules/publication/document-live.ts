import { Socket, type Channel } from "phoenix";
import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";

import { request } from "app";
import { decode, encode } from "./document-remote";

/**
 * The origin stamped on a change that arrived over the wire.
 *
 * Distinct from the one the stored updates carry, but used the same way: a
 * change that came from elsewhere is not posted back, and is not this person's
 * to undo.
 */
const RELAYED = Symbol("relayed");

/** Where the socket lives, derived from wherever the API is. */
function socketUrl(): string {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "";

  // The API is served under `/api` on the same host as the socket.
  return `${api.replace(/\/api\/?$/, "")}/socket`;
}

/** A token to open a connection with, minted behind the session cookie. */
async function socketToken(): Promise<string> {
  return request(async (http) => {
    const { data } = await http.post<{ token: string }>(
      "documents/socket-token",
    );

    return data.token;
  });
}

type Live = {
  /** Who else is here, and where they are looking. */
  awareness: Awareness;
  stop: () => void;
};

/**
 * Keep this document in step with the people who have it open.
 *
 * Changes cross as the opaque bytes they already are, so this is a transport
 * for what is being written down anyway rather than a second way of recording
 * it. A client that misses a message while away is not repaired from here: it
 * reads the stored updates when it next opens the document.
 *
 * Awareness — who is here, and which cell they have focused — crosses the same
 * connection but is never stored. It is true only while someone is looking.
 */
function live(
  doc: Y.Doc,
  id: number,
  isLocal: (origin: unknown) => boolean,
): Live {
  const awareness = new Awareness(doc);

  let socket: Socket | undefined;
  let channel: Channel | undefined;
  let stopped = false;

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (!isLocal(origin)) return;

    channel?.push("update", { update: encode(update) });
  };

  /** Say who this client is, and where it is looking. */
  const announce = () => {
    channel?.push("awareness", {
      awareness: encode(encodeAwarenessUpdate(awareness, [doc.clientID])),
    });
  };

  const onAwareness = ({
    added,
    updated,
    removed,
  }: {
    added: number[];
    updated: number[];
    removed: number[];
  }) => {
    const changed = [...added, ...updated, ...removed];

    channel?.push("awareness", {
      awareness: encode(encodeAwarenessUpdate(awareness, changed)),
    });
  };

  socketToken()
    .then((token) => {
      if (stopped) return;

      socket = new Socket(socketUrl(), { params: { token } });
      socket.connect();

      channel = socket.channel(`document:${id}`, { clientId: doc.clientID });

      channel.on("update", ({ update }: { update: string }) =>
        Y.applyUpdate(doc, decode(update), RELAYED),
      );

      channel.on("awareness", ({ awareness: state }: { awareness: string }) =>
        applyAwarenessUpdate(awareness, decode(state), RELAYED),
      );

      // Someone's connection has gone. Their awareness would otherwise sit in
      // this list until it timed out, showing somebody who is not there.
      channel.on("left", ({ clientId }: { clientId: number }) =>
        removeAwarenessStates(awareness, [clientId], "left"),
      );

      // Awareness is only sent when it changes, so somebody arriving would see
      // an empty room until the next person moved. An arrival is answered by
      // everyone saying who they are again.
      channel.on("arrived", () => announce());

      channel.join().receive("ok", announce);

      doc.on("update", onUpdate);
      awareness.on("update", onAwareness);
    })
    .catch((reason) => {
      // Editing goes on without it: changes still save, and what was missed
      // arrives when the document is next opened. But a document that is
      // quietly not live looks exactly like one nobody else is editing, so it
      // says so rather than failing silently.
      console.warn("This document is not receiving live changes.", reason);
    });

  return {
    awareness,
    stop: () => {
      stopped = true;
      doc.off("update", onUpdate);

      // Said before the handler that carries it is taken away, so the others
      // hear it. A tab that is simply closed never gets here at all, which is
      // why the server announces a going too.
      removeAwarenessStates(awareness, [doc.clientID], "left");
      awareness.off("update", onAwareness);
      awareness.destroy();

      channel?.leave();
      socket?.disconnect();
    },
  };
}

export { RELAYED, live, socketUrl };
export type { Live };
