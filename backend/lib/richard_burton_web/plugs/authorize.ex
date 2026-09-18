defmodule RichardBurtonWeb.Plugs.Authorize do
  @moduledoc """
  Authorizes the request when the authenticated subject (assigned by an
  `Authenticate` plug) holds the given role, or one that outranks it.

      plug RichardBurtonWeb.Plugs.Authorize, role: :contributor

  A route names the least role it needs, so a role ranked above it is admitted
  without revisiting every route. The role is read per request, so granting or
  revoking takes effect on the next one rather than at the next sign-in.
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

  # Refuses the request without saying which check failed, so a caller learns
  # nothing it can probe with.
  defp halt_unauthorized(conn) do
    conn |> send_resp(:unauthorized, "Unauthorized, not enough privileges") |> halt
  end
end
