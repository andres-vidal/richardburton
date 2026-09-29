defmodule RichardBurtonWeb.DocumentChannel do
  @moduledoc """
  Relays one import document's changes between the people who have it open,
  and tracks who they are.

  The list of documents is shared, so anyone who may edit publications may join
  any document. Joining a document that does not exist is refused with
  `not_found`.

  A change is an opaque Yjs update, the same bytes the document endpoints
  store. The channel only relays changes and does not parse or store them. A
  change that a connection misses is still in the stored updates.

  The channel carries three other kinds of message:

    * **presence** — who has the document open. Each connection is tracked
      under the person the socket authenticated, with the email address stored
      for that person, so a connection cannot claim to be someone else. Phoenix
      untracks a connection when its process ends, including when it crashes,
      and broadcasts the leave to the other connections.
    * **awareness** — where each person's cursor is. The channel relays the
      opaque Yjs awareness bytes and does not store them, because they only
      matter while the person is connected. A connection can send anything
      about its own cursor, but the identity paired with the cursor comes from
      presence.
    * **sync** — a Yjs state vector, which summarises the changes a connection
      has. It carries the connection it is `from` and, in a reply, the one it
      is `to`. A connection sends one when it joins, and the other connections
      reply with the changes it lacks. This covers changes that were relayed
      before it joined but were not yet stored.

  A joined channel checks again that its person may keep it open. It checks
  whenever `RichardBurton.Auth.Access` broadcasts a change for that person, and
  every five minutes to catch an expired session, since expiry is not
  broadcast. If the check fails, the channel pushes `refused` and closes.
  """

  use Phoenix.Channel

  alias RichardBurton.Auth.Access
  alias RichardBurton.Document
  alias RichardBurton.User
  alias RichardBurtonWeb.DocumentSocket
  alias RichardBurtonWeb.Presence

  # How often a joined channel rechecks `DocumentSocket.allowed?/2`.
  @recheck_after :timer.minutes(5)

  @impl true
  def join("document:" <> id, params, socket) do
    %{subject_id: subject_id, session_id: session_id} = socket.assigns

    with true <- DocumentSocket.allowed?(subject_id, session_id),
         {:ok, document} <- Document.find(id) do
      Phoenix.PubSub.subscribe(RichardBurton.PubSub, Access.topic(subject_id))
      send(self(), {:after_join, params["clientId"]})
      schedule_recheck()

      {:ok, assign(socket, document_id: document.id)}
    else
      false -> {:error, %{reason: "refused"}}
      {:error, :not_found} -> {:error, %{reason: "not_found"}}
    end
  end

  # Pushes the current presence list to the joining connection, then tracks it
  # so the other connections receive a `presence_diff`. The tracked meta holds
  # the `clientId` from the join params, which is the key of the connection's
  # own awareness entry, so its cursor can be matched to the person in presence.
  @impl true
  def handle_info({:after_join, client_id}, socket) do
    push(socket, "presence_state", Presence.list(socket))

    {:ok, _} =
      Presence.track(socket, socket.assigns.subject_id, %{
        client_id: client_id,
        email: email_of(socket.assigns.subject_id)
      })

    {:noreply, socket}
  end

  def handle_info(:access_changed, socket), do: recheck(socket)

  def handle_info(:recheck, socket) do
    schedule_recheck()
    recheck(socket)
  end

  @doc """
  Broadcasts an `update`, `awareness` or `sync` message to the other
  connections on the document, and ignores any other event.

  `broadcast_from!` skips the sender, so the sender does not receive its own
  change and apply it a second time.
  """
  @impl true
  def handle_in("update", payload = %{"update" => _}, socket) do
    broadcast_from!(socket, "update", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_in("awareness", payload = %{"awareness" => _}, socket) do
    broadcast_from!(socket, "awareness", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_in("sync", payload = %{"state" => _}, socket) do
    broadcast_from!(socket, "sync", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_in(_event, _payload, socket), do: {:noreply, socket}

  # Keeps the channel open while `DocumentSocket.allowed?/2` holds for its
  # person and session. Otherwise it pushes `refused` with an empty payload and
  # stops with `{:shutdown, :refused}`.
  defp recheck(socket) do
    %{subject_id: subject_id, session_id: session_id} = socket.assigns

    if DocumentSocket.allowed?(subject_id, session_id) do
      {:noreply, socket}
    else
      push(socket, "refused", %{})
      {:stop, {:shutdown, :refused}, socket}
    end
  end

  # Sends this channel `:recheck` after `@recheck_after`.
  defp schedule_recheck, do: Process.send_after(self(), :recheck, @recheck_after)

  # Returns the email stored for the user with this subject id, or nil when
  # there is no such user.
  defp email_of(subject_id) do
    case User.get(subject_id) do
      %User{email: email} -> email
      nil -> nil
    end
  end
end
