defmodule RichardBurtonWeb.Plugs.VerifyCsrf do
  @moduledoc """
  Checks the CSRF token of a request that can change data, by the
  double-submit pattern. A GET, HEAD or OPTIONS request passes unchecked.

  Any other request must carry an `rb-csrf-token` header with a valid
  `RichardBurton.Auth.Csrf` token for the subject that `Authenticate.Cookie`
  assigned, so that plug must run first. Another site can make a browser send
  the session cookie, but it cannot read the token to put it in the header.
  The check adds to the protection of the `SameSite=Lax` cookie.

  A request that fails the check is refused with a 403 and the reason
  `invalid_csrf`.
  """
  @behaviour Plug

  alias RichardBurton.Auth.Csrf

  import Plug.Conn
  import RichardBurtonWeb.Refusal

  @safe_methods ~w(GET HEAD OPTIONS)

  @impl true
  def init(params), do: params

  @impl true
  def call(conn = %{method: method}, _params) when method in @safe_methods do
    conn
  end

  def call(conn, _params) do
    with [token] <- get_req_header(conn, Csrf.header_name()),
         {:ok, subject_id} <- Csrf.verify(token),
         true <- subject_id == conn.assigns[:subject_id] do
      conn
    else
      _ -> refuse(conn, :forbidden, :invalid_csrf)
    end
  end
end
