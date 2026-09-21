defmodule RichardBurtonWeb.WorkspaceController do
  @moduledoc """
  The workspace endpoints: starting one, listing the ones a person may open,
  and the updates its document is made of.

  Updates go in and out as base64 in JSON, because that is what the rest of this
  API speaks. The server never parses one — see `RichardBurton.Workspace`.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.User
  alias RichardBurton.Workspace

  @doc """
  A short-lived token for this person to open a live connection with.

  The session cookie is httpOnly, so the page cannot read it to hand over as a
  connect parameter. This is minted behind the same authentication and says only
  who is asking; which workspaces they may open is decided on joining.
  """
  def socket_token(conn, _params) do
    json(conn, %{token: RichardBurtonWeb.WorkspaceSocket.sign(conn.assigns.subject_id)})
  end

  def index(conn, _params) do
    json(conn, %{entries: Workspace.for_user(actor_id(conn))})
  end

  def create(conn, params) do
    case Workspace.create(params, actor_id(conn)) do
      {:ok, workspace} ->
        conn |> put_status(:created) |> json(workspace)

      {:error, changeset} ->
        conn
        |> put_status(:bad_request)
        |> json(%{errors: RichardBurton.Validation.get_errors(changeset)})
    end
  end

  def show(conn, %{"id" => id}) do
    with_workspace(conn, id, fn workspace ->
      json(conn, %{workspace: workspace, members: Workspace.members(workspace)})
    end)
  end

  @doc """
  Everything needed to rebuild the document, oldest first.

  A client applies them in order and is then holding the same document as
  everyone else who has read it.
  """
  def updates(conn, %{"id" => id}) do
    with_workspace(conn, id, fn workspace ->
      json(conn, %{
        entries: Enum.map(Workspace.updates(workspace), &Base.encode64/1)
      })
    end)
  end

  @doc """
  Append one change, with the row count the client counted while making it.
  """
  def append(conn, params = %{"id" => id, "update" => update}) do
    with_workspace(conn, id, fn workspace ->
      case Base.decode64(update) do
        {:ok, bytes} ->
          {:ok, _} = Workspace.append(workspace, bytes, params["rows"] || workspace.rows)
          send_resp(conn, :no_content, "")

        :error ->
          conn |> put_status(:bad_request) |> json(%{error: :invalid_update})
      end
    end)
  end

  @doc """
  Replace the workspace's updates with one merged update that means the same.

  Only a client can merge them, since only a client reads the document.
  """
  def compact(conn, %{"id" => id, "update" => update}) do
    with_workspace(conn, id, fn workspace ->
      case Base.decode64(update) do
        {:ok, bytes} ->
          {:ok, _} = Workspace.compact(workspace, bytes)
          send_resp(conn, :no_content, "")

        :error ->
          conn |> put_status(:bad_request) |> json(%{error: :invalid_update})
      end
    end)
  end

  @doc """
  Let someone else open this workspace, named by the email they signed in with.
  """
  def add_member(conn, %{"id" => id, "email" => email}) do
    with_workspace(conn, id, fn workspace ->
      let_in(conn, workspace, User.get_by_email(email))
    end)
  end

  # Letting someone in, once the workspace is known. Somebody with no account
  # cannot be let into one, which is a different answer from being refused.
  defp let_in(conn, _workspace, nil) do
    conn |> put_status(:not_found) |> json(%{error: :no_such_user})
  end

  defp let_in(conn, workspace, user) do
    case Workspace.add_member(workspace, user.id, actor_id(conn)) do
      :ok -> send_resp(conn, :no_content, "")
      {:error, reason} -> conn |> put_status(:forbidden) |> json(%{error: reason})
    end
  end

  # Runs `found` with the workspace, or answers 404 — which is also the answer
  # for a workspace this person may not open, since whether it exists is not
  # theirs to know.
  defp with_workspace(conn, id, found) do
    case Workspace.find(id, actor_id(conn)) do
      {:ok, workspace} -> found.(workspace)
      {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: :not_found})
    end
  end

  defp actor_id(conn), do: User.get(conn.assigns.subject_id).id
end
