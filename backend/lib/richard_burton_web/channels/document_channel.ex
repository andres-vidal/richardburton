defmodule RichardBurtonWeb.DocumentChannel do
  @moduledoc """
  Relays one import document's changes between the people who have it open.

  The list of documents is shared, so being connected is the permission: anyone
  who may edit publications may join any document. Joining one that does not
  exist is refused, which is the only thing there is to check.

  A change is an opaque Yjs update, the same bytes the endpoints persist — this
  is a transport for what is already being written down, not a second way of
  recording it. Nothing here parses one, and nothing here stores one: a client
  that misses a message while away gets it from the stored updates on opening.

  Awareness is the other thing that crosses: who is here. It is deliberately
  *not* persisted, because it is true only while someone is looking.
  """

  use Phoenix.Channel

  alias RichardBurton.Document

  @impl true
  def join("document:" <> id, params, socket) do
    case Document.find(id) do
      {:ok, document} ->
        # The client says which awareness entry is its own, so that its going
        # can be announced on its behalf. A tab that is closed runs no cleanup
        # of its own, and a person who has gone should not sit in everyone
        # else's list until a timeout notices.
        send(self(), :announce_arrival)
        {:ok, assign(socket, document_id: document.id, client_id: params["clientId"])}

      {:error, :not_found} ->
        {:error, %{reason: "not_found"}}
    end
  end

  # Tells everyone already here that somebody has arrived, so each of them says
  # who they are again. Awareness is only ever broadcast when it changes, so
  # without this the newcomer would see an empty room until somebody moved.
  @impl true
  def handle_info(:announce_arrival, socket) do
    broadcast_from!(socket, "arrived", %{})
    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, socket) do
    case socket.assigns[:client_id] do
      nil -> :ok
      client_id -> broadcast_from!(socket, "left", %{"clientId" => client_id})
    end
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
  def handle_in(_event, _payload, socket), do: {:noreply, socket}
end
