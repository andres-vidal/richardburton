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

/**
 * Whether this document is hearing from anyone else.
 *
 * `connecting` covers both opening the connection and getting it back, because
 * from where the reader sits those are the same thing: changes are not crossing
 * yet, and something is being done about it.
 */
type LiveState = "connecting" | "live" | "offline";

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

type Hooks = {
  /** Called whenever the connection changes state. */
  onStatus?: (state: LiveState) => void;
  /**
   * Called when the connection comes back after being away.
   *
   * Nothing here replays what was missed: changes are relayed and not stored,
   * so a client that was away has a gap only the stored updates can fill.
   */
  onRejoin?: () => void;
};

/**
 * Keep this document in step with the people who have it open.
 *
 * Changes cross as the opaque bytes they already are, so this is a transport
 * for what is being written down anyway rather than a second way of recording
 * it.
 *
 * A connection that drops is a gap: the changes relayed while it was down were
 * heard by everyone else and not by this client, and nothing in the relay
 * remembers them. Coming back therefore asks for the stored updates again
 * rather than picking up where it left off, which is what `onRejoin` is for.
 *
 * Awareness — who is here, and which cell they have focused — crosses the same
 * connection but is never stored. It is true only while someone is looking.
 *
 * The token that authorises a connection is spent on that connection and is
 * short-lived, so a fresh one is minted for each attempt. Reusing the first one
 * would mean that any outage longer than its life left the document silently
 * unable to reconnect for as long as the tab stayed open.
 */
function live(
  doc: Y.Doc,
  id: number,
  isLocal: (origin: unknown) => boolean,
  { onStatus, onRejoin }: Hooks = {},
): Live {
  const awareness = new Awareness(doc);

  let socket: Socket | undefined;
  let channel: Channel | undefined;
  let stopped = false;
  let token: string | undefined;
  let joined = false;

  const report = (state: LiveState) => {
    if (!stopped) onStatus?.(state);
  };

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

  /**
   * Put a fresh token in place for the next attempt.
   *
   * The socket reads it when it connects, so replacing the value is all that is
   * needed. An attempt that happens before this lands fails and is retried,
   * by which time it has.
   */
  const refresh = () => {
    socketToken()
      .then((minted) => {
        token = minted;
      })
      .catch(() => {
        // Nothing to do here: the connection stays down, which is already what
        // is being reported, and the next attempt asks again.
      });
  };

  report("connecting");

  socketToken()
    .then((minted) => {
      if (stopped) return;

      token = minted;

      socket = new Socket(socketUrl(), { params: () => ({ token }) });

      socket.onOpen(() => {
        // The token is spent. Getting the next one now means it is ready before
        // the connection that will need it drops.
        refresh();
      });

      socket.onError(() => {
        report("offline");
        refresh();
      });

      socket.onClose(() => {
        if (stopped) return;

        report("connecting");
        refresh();
      });

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
      //
      // A client says which entry is its own when it joins, and nothing checks
      // that claim, so this is not proof that the person named has left. Saying
      // so about this client is the one case worth refusing: its own going is
      // the one thing it knows better than anyone.
      channel.on("left", ({ clientId }: { clientId: number }) => {
        if (clientId === doc.clientID) {
          announce();
          return;
        }

        removeAwarenessStates(awareness, [clientId], "left");
      });

      // Awareness is only sent when it changes, so somebody arriving would see
      // an empty room until the next person moved. An arrival is answered by
      // everyone saying who they are again.
      channel.on("arrived", () => announce());

      channel.onError(() => report("offline"));

      channel
        .join()
        .receive("ok", () => {
          report("live");
          announce();

          // Only on getting the connection back: the first join has just read
          // the stored updates by another route.
          if (joined) onRejoin?.();
          joined = true;
        })
        .receive("error", () => report("offline"))
        .receive("timeout", () => report("offline"));

      doc.on("update", onUpdate);
      awareness.on("update", onAwareness);
    })
    .catch((reason) => {
      // Editing goes on without it: changes still save, and what was missed
      // arrives when the document is next opened. But a document that is
      // quietly not live looks exactly like one nobody else is editing, so it
      // says so rather than failing silently.
      report("offline");
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
export type { Live, LiveState };
