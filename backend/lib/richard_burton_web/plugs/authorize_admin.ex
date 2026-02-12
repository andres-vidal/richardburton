defmodule RichardBurtonWeb.Plugs.AuthorizeAdmin do
  @moduledoc """
  Plug for authentication with Google
  """

  alias RichardBurton.Auth

  import Plug.Conn

  def init(params), do: params

  def call(conn = %{assigns: %{subject_id: subject_id}}, _params) do
    case Auth.authorize(subject_id, :admin) do
      :ok -> conn
      :error -> halt_unauthorized(conn)
    end
  end

  def call(conn, _params) do
    halt_unauthorized(conn)
  end

  defp halt_unauthorized(conn) do
    conn |> send_resp(:unauthorized, "Unauthorized, not enough privileges") |> halt()
  end
end
