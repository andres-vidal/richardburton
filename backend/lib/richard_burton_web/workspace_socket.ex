defmodule RichardBurtonWeb.WorkspaceSocket do
  @moduledoc """
  The socket workspaces are edited live over.

  It is authenticated by a short-lived token rather than by the `rb-session`
  cookie. The cookie is httpOnly, so the page cannot read it to pass as a
  connect parameter, and a token also survives a transport that carries no
  cookies at all.

  The token says who, and nothing about which workspace: what a person may open
  is decided when they join a channel, against the same rule the endpoints use.
  """

  use Phoenix.Socket

  @salt "workspace socket"

  # Long enough to be fetched and used, short enough that one left lying around
  # is worth little. It authenticates the connection, not the session: a socket
  # that stays open is not re-checked against it.
  @max_age 60

  channel("workspace:*", RichardBurtonWeb.WorkspaceChannel)

  @doc "A token for this subject to connect with."
  def sign(subject_id) do
    Phoenix.Token.sign(RichardBurtonWeb.Endpoint, @salt, subject_id)
  end

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case Phoenix.Token.verify(RichardBurtonWeb.Endpoint, @salt, token, max_age: @max_age) do
      {:ok, subject_id} -> {:ok, assign(socket, :subject_id, subject_id)}
      {:error, _reason} -> :error
    end
  end

  @impl true
  def connect(_params, _socket, _connect_info), do: :error

  # Every socket a person has open, named together, so signing out or losing
  # access can close all of them at once.
  @impl true
  def id(socket), do: "workspace_socket:#{socket.assigns.subject_id}"
end
