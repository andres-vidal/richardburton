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
  development over plain HTTP needs.
  """

  import Plug.Conn

  alias RichardBurton.Auth.Csrf
  alias RichardBurton.Auth.Session

  @csrf_cookie "csrf-token"

  @doc """
  Creates a session for `subject_id` and sets both cookies on `conn`. The
  `:secure` option overrides the `:phx_session_tls` setting.
  """
  def put(conn, subject_id, opts \\ []) do
    {:ok, token} = Session.create(subject_id)
    secure = Keyword.get(opts, :secure, secure?())

    conn
    |> put_resp_cookie(Session.cookie_name(), token,
      http_only: true,
      same_site: "Lax",
      secure: secure,
      max_age: Session.max_age()
    )
    |> put_resp_cookie(@csrf_cookie, Csrf.sign(subject_id),
      http_only: false,
      same_site: "Lax",
      secure: secure,
      max_age: Session.max_age()
    )
  end

  @doc "Deletes both cookies from the browser."
  def delete(conn) do
    conn
    |> delete_resp_cookie(Session.cookie_name(), same_site: "Lax", secure: secure?())
    |> delete_resp_cookie(@csrf_cookie, same_site: "Lax", secure: secure?(), http_only: false)
  end

  # Returns whether the cookies are `Secure`.
  defp secure?, do: Application.get_env(:richard_burton, :phx_session_tls, true)
end
