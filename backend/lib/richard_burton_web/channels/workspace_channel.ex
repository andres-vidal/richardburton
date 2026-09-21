defmodule RichardBurtonWeb.WorkspaceChannel do
  @moduledoc """
  Relays one workspace's changes between the people who have it open.

  A change is an opaque Yjs update, the same bytes the endpoints persist — this
  is a transport for what is already being written down, not a second way of
  recording it. Nothing here parses one, and nothing here stores one: a client
  that misses a message while away gets it from the stored updates on opening.

  Awareness is the other thing that crosses: who is here and which cell they
  have focused. It is deliberately *not* persisted, because it is true only
  while someone is looking.
  """

  use Phoenix.Channel

  alias RichardBurton.User
  alias RichardBurton.Workspace

  @impl true
  def join("workspace:" <> id, _params, socket) do
    with %User{id: user_id} <- User.get(socket.assigns.subject_id),
         {:ok, workspace} <- Workspace.find(id, user_id) do
      {:ok, assign(socket, workspace_id: workspace.id, user_id: user_id)}
    else
      # A workspace this person may not open is not said to exist, the same
      # answer the endpoint gives.
      _ -> {:error, %{reason: "not_found"}}
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
