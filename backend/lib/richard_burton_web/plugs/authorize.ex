defmodule RichardBurtonWeb.Plugs.Authorize do
  @moduledoc """
  Admits a request when the subject that an `Authenticate` plug assigned holds
  the given role, or a role that outranks it.

      plug RichardBurtonWeb.Plugs.Authorize, role: :contributor

  A route names the least role it needs, so the roles above it are admitted
  too. The role is read on every request, so a change of role applies from the
  next request rather than from the next sign-in.

  Any other request is refused with a 403 and the reason `forbidden`, including
  one that reaches this plug with no subject assigned.
  """
  @behaviour Plug

  alias RichardBurton.User

  import RichardBurtonWeb.Refusal

  @impl true
  def init(params), do: Keyword.fetch!(params, :role)

  @impl true
  def call(conn = %{assigns: %{subject_id: subject_id}}, role) do
    case User.authorize(subject_id, role) do
      :ok -> conn
      :error -> refuse(conn, :forbidden, :forbidden)
    end
  end

  def call(conn, _role) do
    refuse(conn, :forbidden, :forbidden)
  end
end
