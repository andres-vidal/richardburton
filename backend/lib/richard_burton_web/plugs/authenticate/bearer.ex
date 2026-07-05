defmodule RichardBurtonWeb.Plugs.Authenticate.Bearer do
  @moduledoc """
  Authenticates a request via an identity-provider token in the
  `Authorization: Bearer` header (see `RichardBurton.Auth`) and assigns
  `:subject_id`. Used by the login endpoints that exchange the provider token
  for a session.
  """
  alias RichardBurton.Auth

  import Plug.Conn

  def init(params), do: params

  def call(conn, _params) do
    case verify(conn) do
      {:ok, subject_id} -> assign(conn, :subject_id, subject_id)
      :error -> halt_unauthorized(conn)
    end
  end

  defp verify(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> Auth.verify(token)
      _ -> :error
    end
  end

  defp halt_unauthorized(conn) do
    conn |> send_resp(:unauthorized, "Unauthorized") |> halt()
  end
end
