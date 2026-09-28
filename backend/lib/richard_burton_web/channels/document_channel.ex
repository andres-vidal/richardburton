defmodule RichardBurtonWeb.DocumentChannel do
  @moduledoc """
  Relays one import document's changes between the people who have it open,
  and keeps track of who they are.

  The list of documents is shared, so being allowed onto the socket is the
  permission: anyone who may edit publications may join any document. Joining
  one that does not exist is refused.

  A change is an opaque Yjs update, the same bytes the endpoints persist — this
  is a transport for what is already being written down, not a second way of
  recording it. Nothing here parses one, and nothing here stores one: a client
  that misses a message while away gets it from the stored updates on opening.

  Three further things cross:

    * **presence** — who has the document open. Tracked here, per connection,
      under the person the socket was authenticated as and the address the
      server holds for them, so nobody's presence rests on what their own
      connection claims. Phoenix untracks a connection when its process ends,
      however it ends, and broadcasts the leave to everyone still here.
    * **awareness** — where each person's cursor is. Relayed as the opaque Yjs
      awareness bytes it is and never stored, because it is true only while
      someone is looking. A connection can claim anything about its own cursor,
      which costs nothing: the identity paired with it comes from presence.
    * **sync** — a Yjs state vector, the summary of which changes a connection
      holds, with the connection it comes `from` and, in an answer, the one it
      is `to`. A connection sends one on joining, and the changes sent back for
      it are the ones the stored updates did not have yet: a change still being
      saved was relayed before the newcomer was here to receive it.

  A joined channel keeps checking that it may stay: whenever a change to its
  person's access is announced, and every few minutes for the one change that is
  not announced, a session running out. When the answer is no it says so and
  closes.
  """

  use Phoenix.Channel

  alias RichardBurton.Auth.Access
  alias RichardBurton.Document
  alias RichardBurton.User
  alias RichardBurtonWeb.DocumentSocket
  alias RichardBurtonWeb.Presence

  # How often an open channel checks again whether it may stay.
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

  # Tells the newcomer who is already here, then tracks them so everyone else
  # hears of them. The join names which awareness entry is the connection's own,
  # so the cursor it relays can be paired with the identity presence holds.
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
  Hand a change to everyone else here.

  `broadcast_from!` leaves out the sender, which is what keeps a client from
  being handed back what it just made and applying its own change twice.
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

  # Stays while the session stands and its person may still keep the database.
  # Otherwise it pushes `refused`, which names why, and then closes.
  defp recheck(socket) do
    %{subject_id: subject_id, session_id: session_id} = socket.assigns

    if DocumentSocket.allowed?(subject_id, session_id) do
      {:noreply, socket}
    else
      push(socket, "refused", %{})
      {:stop, {:shutdown, :refused}, socket}
    end
  end

  defp schedule_recheck, do: Process.send_after(self(), :recheck, @recheck_after)

  defp email_of(subject_id) do
    case User.get(subject_id) do
      %User{email: email} -> email
      nil -> nil
    end
  end
end
