defmodule RichardBurtonWeb.Plugs.Authorize do
  @moduledoc """
  Authorizes the request when the authenticated subject (assigned by an
  `Authenticate` plug) holds the given role, or one that outranks it.

      plug RichardBurtonWeb.Plugs.Authorize, role: :contributor

  A route asks for the least it needs, so a role added above that one is
  admitted without every route being revisited. The role is re-read per request,
  so granting or revoking takes effect on the next one rather than the next
  sign-in.
  """

  alias RichardBurton.Auth

  import Plug.Conn

  def init(params), do: Keyword.fetch!(params, :role)

  def call(conn = %{assigns: %{subject_id: subject_id}}, role) do
    case Auth.authorize(subject_id, role) do
      :ok -> conn
      :error -> halt_unauthorized(conn)
    end
  end

  def call(conn, _role) do
    halt_unauthorized(conn)
  end

  defp halt_unauthorized(conn) do
    conn |> send_resp(:unauthorized, "Unauthorized, not enough privileges") |> halt
  end
end
