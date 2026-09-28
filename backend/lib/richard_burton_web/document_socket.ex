defmodule RichardBurtonWeb.DocumentSocket do
  @moduledoc """
  The socket import documents are edited live over.

  It is authenticated by a token rather than by the \`rb-session\` cookie. The
  cookie is httpOnly, so the page cannot read it to hand over, and a token also
  survives a transport that carries no cookies at all.

  The token names the session it was minted under as well as the person, and
  travels in a header rather than in the address, so it appears in no request
  log. Whether that session still stands, and whether its person may still keep
  the database, is asked again on every connect and every join — the way
  \`Plugs.Authorize\` asks on every request — so the token's age is not what keeps
  anybody out, and it lives as long as the session could.
  """

  use Phoenix.Socket

  alias RichardBurton.Auth
  alias RichardBurton.Auth.Session

  @salt "document socket"

  # As long as the session it names could last. What refuses a connection is
  # the session having gone, not the token having aged.
  @max_age Session.max_age()

  channel("document:*", RichardBurtonWeb.DocumentChannel)

  @doc "A token for this person, under this session, to connect with."
  def sign(subject_id, session_id) do
    Phoenix.Token.sign(RichardBurtonWeb.Endpoint, @salt, %{
      "subject" => subject_id,
      "session" => session_id
    })
  end

  @doc """
  Whether a person may be connected under a session: the session still stands,
  and they may still keep the database.
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

  # Nothing is closed from outside by this name: a change of access is
  # announced, and each channel checks its own session. See
  # `RichardBurton.Auth.Access`.
  @impl true
  def id(_socket), do: nil
end
