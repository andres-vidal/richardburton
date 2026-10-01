defmodule RichardBurtonWeb.DocumentSocket do
  @moduledoc """
  The socket for editing import documents live, with one
  `RichardBurtonWeb.DocumentChannel` per document.

  It authenticates with the `rb-session` cookie, as HTTP requests do. The
  connect request carries the cookie, and `RichardBurtonWeb.SessionCookie`
  passes its value to `connect/3`. Connecting counts as use of the session:
  `Session.verify/1` slides its idle timeout. The later checks use
  `Session.active?/1`, which does not.

  A connect request must also carry the CSRF token from the `csrf-token`
  cookie, in the auth-token header rather than the URL, and the token must be
  for the session's person. This is the double-submit check that
  `RichardBurtonWeb.Plugs.VerifyCsrf` makes for HTTP requests. A connect
  request sent from another origin can carry the session cookie, but its
  sender cannot read the CSRF token, so the request is refused.

  `allowed?/2` is checked on every connect and every join, in the same way
  `Plugs.Authorize` checks every request.
  """

  use Phoenix.Socket

  alias RichardBurton.Auth
  alias RichardBurton.Auth.Csrf
  alias RichardBurton.Auth.Session

  channel("document:*", RichardBurtonWeb.DocumentChannel)

  @doc """
  Returns whether the session is still active and the person still has the
  contributor role or a higher one.
  """
  def allowed?(subject_id, session_id) do
    Session.active?(session_id) and Auth.authorize(subject_id, :contributor) == :ok
  end

  @impl true
  def connect(_params, socket, %{session: %{"token" => token}, auth_token: csrf_token}) do
    with {:ok, session} <- Session.verify(token),
         {:ok, subject_id} <- Csrf.verify(csrf_token),
         true <- subject_id == session.subject_id,
         true <- allowed?(subject_id, session.id) do
      {:ok, assign(socket, subject_id: subject_id, session_id: session.id)}
    else
      _refused -> :error
    end
  end

  def connect(_params, _socket, _connect_info), do: :error

  # Returns nil, so there is no socket id to broadcast a disconnect to. Instead,
  # `RichardBurton.Auth.Access` broadcasts a change of access, and each channel
  # checks its own session.
  @impl true
  def id(_socket), do: nil
end
