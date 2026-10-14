defmodule RichardBurtonWeb.Plugs.Authenticate.Cookie do
  @moduledoc """
  Authenticates a request via the app's own `rb-session` cookie
  (see `RichardBurton.Auth.Session`) and assigns `:subject_id`.
  """
  alias RichardBurton.Auth.Session

  import Plug.Conn

  def init(params), do: params

  def call(conn, _params) do
    case verify(conn) do
      {:ok, session} -> assign(conn, :subject_id, session.subject_id)
      :error -> halt_unauthorized(conn)
    end
  end

  @doc """
  Returns `{:ok, session}` for the request's `rb-session` cookie when it holds
  a valid session, and `:error` when there is no cookie or its session is not
  valid. It does not halt the request.
  """
  @spec verify(Plug.Conn.t()) :: {:ok, Session.t()} | :error
  def verify(conn) do
    case fetch_cookies(conn).cookies[Session.cookie_name()] do
      nil -> :error
      token -> Session.verify(token)
    end
  end

  # Refuses the request without saying which check failed, so a caller learns
  # nothing it can probe with.
  defp halt_unauthorized(conn) do
    conn |> send_resp(:unauthorized, "Unauthorized") |> halt()
  end
end
