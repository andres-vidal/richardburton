defmodule RichardBurtonWeb.Plugs.Authenticate.Cookie do
  @moduledoc """
  Authenticates a request via the app's own `rb-session` cookie
  (see `RichardBurton.Auth.Session`) and assigns `:subject_id`, and
  `:session_id` for whatever has to refer back to the session later.
  """
  alias RichardBurton.Auth.Session

  import Plug.Conn

  def init(params), do: params

  def call(conn, _params) do
    case verify(conn) do
      {:ok, session} ->
        conn |> assign(:subject_id, session.subject_id) |> assign(:session_id, session.id)

      :error ->
        halt_unauthorized(conn)
    end
  end

  # The session token from the cookie, verified against the stored sessions.
  defp verify(conn) do
    case fetch_cookies(conn).cookies[Session.cookie_name()] do
      nil -> :error
      token -> Session.verify_session(token)
    end
  end

  # Refuses the request without saying which check failed, so a caller learns
  # nothing it can probe with.
  defp halt_unauthorized(conn) do
    conn |> send_resp(:unauthorized, "Unauthorized") |> halt()
  end
end
