defmodule RichardBurtonWeb.DocumentSocket do
  @moduledoc """
  The socket import documents are edited live over.

  It is authenticated by a short-lived token rather than by the `rb-session`
  cookie. The cookie is httpOnly, so the page cannot read it to pass as a
  connect parameter, and a token also survives a transport that carries no
  cookies at all.

  The token says who is connecting, and no more: the list of documents is
  shared, so being connected at all is the permission to join any of them.
  """

  use Phoenix.Socket

  @salt "document socket"

  # Long enough to be fetched and used, short enough that one left lying around
  # is worth little. It authenticates the connection, not the session: a socket
  # that stays open is not re-checked against it.
  @max_age 60

  channel("document:*", RichardBurtonWeb.DocumentChannel)

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
  def id(socket), do: topic(socket.assigns.subject_id)

  @doc """
  Close every live connection this person has open.

  A token authorises a connection rather than the session behind it, and a
  socket already open is never checked against it again. Signing out therefore
  has to say so, or the document stays live in a tab that is signed out.
  """
  def disconnect(subject_id) do
    RichardBurtonWeb.Endpoint.broadcast(topic(subject_id), "disconnect", %{})
  end

  defp topic(subject_id), do: "document_socket:#{subject_id}"
end
