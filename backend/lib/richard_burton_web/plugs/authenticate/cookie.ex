defmodule RichardBurtonWeb.Plugs.Authenticate.Cookie do
  @moduledoc """
  Authenticates a request by the app's own `rb-session` cookie (see
  `RichardBurton.Auth.Session`), and assigns the session's `:subject_id`.

  A request without the cookie, or with a session that is not valid, is
  refused with a 401 and the reason `unauthorized`. The response does not say
  which of the two it was.
  """
  @behaviour Plug

  alias RichardBurton.Auth.Session

  import Plug.Conn
  import RichardBurtonWeb.Refusal

  @impl true
  def init(params), do: params

  @impl true
  def call(conn, _params) do
    case verify(conn) do
      {:ok, session} -> assign(conn, :subject_id, session.subject_id)
      :error -> refuse(conn, :unauthorized, :unauthorized)
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
end
