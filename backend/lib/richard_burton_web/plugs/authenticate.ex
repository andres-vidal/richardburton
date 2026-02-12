defmodule RichardBurtonWeb.Plugs.Authenticate do
  @moduledoc """
  Plug for authentication with Google
  """
  alias RichardBurton.Auth

  import Plug.Conn

  def init(params), do: params

  @spec call(Plug.Conn.t(), any) :: Plug.Conn.t()
  def call(conn, _params) do
    case verify(conn) do
      {:ok, subject_id} -> assign(conn, :subject_id, subject_id)
      :error -> halt_unauthorized(conn)
    end
  end

  defp verify(conn) do
    case Plug.Conn.get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> Auth.verify(token)
      _ -> :error
    end
  end

  defp halt_unauthorized(conn) do
    conn |> send_resp(:unauthorized, "Unauthorized") |> halt()
  end
end
