defmodule RichardBurtonWeb.DocumentSocket do
  @moduledoc """
  The socket for editing import documents live, with one
  `RichardBurtonWeb.DocumentChannel` per document.

  It authenticates with a token from `sign/2` instead of the `rb-session`
  cookie. The cookie is httpOnly, so it cannot be read and sent as a connect
  parameter. A token also works on a transport that carries no cookies.

  The token holds the person's `subject_id` and the id of the session it was
  signed under. It is sent in a header, not in the query string, so it does
  not appear in request logs. `allowed?/2` is checked on every connect and
  every join, in the same way `Plugs.Authorize` checks every request. Because
  of this, the token's age does not decide whether a connection is refused,
  and the token is valid for as long as the session can last.
  """

  use Phoenix.Socket

  alias RichardBurton.Auth
  alias RichardBurton.Auth.Session

  @salt "document socket"

  # The session's absolute cap. A connection is refused when its session is no
  # longer active, so the token does not need a shorter lifetime.
  @max_age Session.max_age()

  channel("document:*", RichardBurtonWeb.DocumentChannel)

  @doc "Signs a socket token that holds `subject_id` and `session_id`."
  def sign(subject_id, session_id) do
    Phoenix.Token.sign(RichardBurtonWeb.Endpoint, @salt, %{
      "subject" => subject_id,
      "session" => session_id
    })
  end

  @doc """
  Returns whether the session is still active and the person still has the
  contributor role or a higher one.
  """
  def allowed?(subject_id, session_id) do
    Session.active?(session_id) and Auth.authorize(subject_id, :contributor) == :ok
  end

  @impl true
  def connect(_params, socket, %{auth_token: token}) when is_binary(token) do
    with {:ok, %{"subject" => subject_id, "session" => session_id}} <-
           Phoenix.Token.verify(RichardBurtonWeb.Endpoint, @salt, token, max_age: @max_age),
         true <- allowed?(subject_id, session_id) do
      {:ok, assign(socket, subject_id: subject_id, session_id: session_id)}
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
