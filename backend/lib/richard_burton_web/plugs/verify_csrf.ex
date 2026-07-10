defmodule RichardBurtonWeb.Plugs.VerifyCsrf do
  @moduledoc """
  Double-submit CSRF check for state-changing admin requests. Safe methods
  (GET/HEAD/OPTIONS) pass through untouched. For unsafe methods it requires an
  `rb-csrf-token` header carrying a valid `RichardBurton.Auth.Csrf` token whose
  subject matches the authenticated session (assigned by `Authenticate.Cookie`,
  which must run first). Defense in depth on top of the `SameSite=Lax` cookie.
  """
  alias RichardBurton.Auth.Csrf

  import Plug.Conn

  @safe_methods ~w(GET HEAD OPTIONS)

  def init(params), do: params

  def call(conn = %{method: method}, _params) when method in @safe_methods do
    conn
  end

  def call(conn, _params) do
    with [token] <- get_req_header(conn, "rb-csrf-token"),
         {:ok, subject_id} <- Csrf.verify(token),
         true <- subject_id == conn.assigns[:subject_id] do
      conn
    else
      _ -> conn |> send_resp(:forbidden, "Invalid CSRF token") |> halt()
    end
  end
end
