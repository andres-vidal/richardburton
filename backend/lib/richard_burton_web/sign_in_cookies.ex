defmodule RichardBurtonWeb.SignInCookies do
  @moduledoc """
  Sets and deletes the two cookies of a signed-in browser:

    * `rb-session`, which is http-only and holds the session token (see
      `RichardBurton.Auth.Session`);
    * `csrf-token`, which can be read by scripts and holds the token the
      browser sends back in the `rb-csrf-token` header (see
      `RichardBurton.Auth.Csrf`).

  Both cookies are `SameSite=Lax` and last as long as a session. They are
  `Secure` unless the `:phx_session_tls` setting is false, which only local
  development and end-to-end tests over plain HTTP need.
  """

  import Plug.Conn

  alias RichardBurton.Auth.Csrf
  alias RichardBurton.Auth.Session

  @csrf_cookie "csrf-token"

  @doc "Creates a session for `subject_id` and sets both cookies on `conn`."
  @spec put(Plug.Conn.t(), String.t()) :: Plug.Conn.t()
  def put(conn, subject_id) do
    {:ok, token} = Session.create(subject_id)
    lifetime = [max_age: Session.max_age()]

    conn
    |> put_resp_cookie(Session.cookie_name(), token, lifetime ++ attributes(true))
    |> put_resp_cookie(@csrf_cookie, Csrf.sign(subject_id), lifetime ++ attributes(false))
  end

  @doc "Deletes both cookies from the browser."
  @spec delete(Plug.Conn.t()) :: Plug.Conn.t()
  def delete(conn) do
    conn
    |> delete_resp_cookie(Session.cookie_name(), attributes(true))
    |> delete_resp_cookie(@csrf_cookie, attributes(false))
  end

  # Returns the attributes of a sign-in cookie, which is http-only when
  # `http_only` is true.
  defp attributes(http_only) do
    [
      http_only: http_only,
      same_site: "Lax",
      secure: Application.get_env(:richard_burton, :phx_session_tls, true)
    ]
  end
end
