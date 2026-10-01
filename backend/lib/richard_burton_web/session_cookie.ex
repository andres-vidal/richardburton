defmodule RichardBurtonWeb.SessionCookie do
  @moduledoc """
  A read-only `Plug.Session.Store` that returns the raw value of the
  `rb-session` cookie as `%{"token" => token}`.

  Phoenix passes a cookie to a socket's `connect/3` only as a session read
  through a `Plug.Session` store. The `rb-session` cookie holds a session token,
  not a Plug session, so this store returns the token as it is, without
  decoding or checking it.

  The store cannot write. `put/4` and `delete/3` raise, because sessions are
  created and revoked by `RichardBurton.Auth.Session`.
  """

  @behaviour Plug.Session.Store

  @impl true
  def init(opts), do: opts

  @impl true
  def get(_conn, token, _opts), do: {nil, %{"token" => token}}

  @impl true
  def put(_conn, _sid, _data, _opts), do: raise(ArgumentError, "the session cookie is read-only")

  @impl true
  def delete(_conn, _sid, _opts), do: raise(ArgumentError, "the session cookie is read-only")
end
