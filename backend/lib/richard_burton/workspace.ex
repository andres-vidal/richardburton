defmodule RichardBurton.Workspace do
  @moduledoc """
  A bulk-import workspace: rows being prepared, kept between sittings and
  shareable with another contributor.

  A workspace's content is a Yjs document, which this never parses. A document
  is a set of updates that can be applied in any order and more than once, so
  the server appends them and hands them back as the opaque bytes they are.
  Keeping it blind is what keeps a precompiled native dependency out of the
  deployment; the two moments anything has to read a workspace — validating and
  submitting — already take ordinary JSON over the publication endpoints.

  Three words carry specific meanings here:

    * **update** — one opaque change to the document, as Yjs encoded it.
    * **compaction** — replacing every update of a workspace with one merged
      update that means the same thing. What keeps a long-lived workspace cheap
      to open.
    * **member** — someone other than the owner who may open it.

  `rows` is a count the client writes when it writes, since the server cannot
  count rows in bytes it does not parse. It is what a list of workspaces shows,
  and it is the client's word.
  """

  use Ecto.Schema

  import Ecto.Changeset
  import Ecto.Query

  alias RichardBurton.Repo
  alias RichardBurton.User
  alias RichardBurton.Workspace

  @derive {Jason.Encoder, only: [:id, :name, :rows, :inserted_at, :updated_at]}
  schema "workspaces" do
    field(:name, :string)
    field(:rows, :integer, default: 0)

    belongs_to(:owner, User)

    timestamps()
  end

  defmodule Update do
    @moduledoc """
    One opaque change to a workspace's document, in the order it was written.

    `compacted` marks a row that stands for every update before it.
    """

    use Ecto.Schema

    schema "workspace_updates" do
      field(:workspace_id, :integer)
      field(:update, :binary)
      field(:compacted, :boolean, default: false)

      timestamps(updated_at: false)
    end
  end

  defmodule Member do
    @moduledoc "Someone other than the owner who may open a workspace."

    use Ecto.Schema

    schema "workspace_members" do
      field(:workspace_id, :integer)
      field(:user_id, :integer)

      timestamps(updated_at: false)
    end
  end

  @doc false
  def changeset(workspace, attrs) do
    workspace
    |> cast(attrs, [:name, :owner_id, :rows])
    |> validate_required([:name, :owner_id])
    |> validate_length(:name, min: 1, max: 200)
    |> validate_number(:rows, greater_than_or_equal_to: 0)
  end

  @doc """
  Start a workspace owned by this user.
  """
  def create(attrs, owner_id) do
    %Workspace{}
    |> changeset(Map.put(attrs, "owner_id", owner_id))
    |> Repo.insert()
  end

  @doc """
  The workspaces this user may open, most recently changed first.

  Both the ones they started and the ones they were let into, since opening one
  is the same act either way.
  """
  def for_user(user_id) do
    from(w in Workspace,
      left_join: m in Member,
      on: m.workspace_id == w.id and m.user_id == ^user_id,
      where: w.owner_id == ^user_id or not is_nil(m.id),
      order_by: [desc: w.updated_at],
      distinct: true
    )
    |> Repo.all()
  end

  @doc """
  The workspace, if this user may open it.

  Returns `:not_found` rather than `:forbidden` for a workspace they are not in:
  whether one exists is not something to tell someone who cannot open it.
  """
  def find(id, user_id) do
    case Repo.get(Workspace, id) do
      nil ->
        {:error, :not_found}

      workspace ->
        if allows?(workspace, user_id), do: {:ok, workspace}, else: {:error, :not_found}
    end
  end

  @doc """
  Everything needed to rebuild this workspace's document, oldest first.

  A compaction stands for every update before it, so reading starts at the last
  one rather than at the beginning.
  """
  def updates(%Workspace{id: id}) do
    from(u in Update, where: u.workspace_id == ^id, order_by: [asc: u.id], select: u.update)
    |> from_last_compaction(id)
    |> Repo.all()
  end

  # Narrows the read to what has happened since the last compaction, which is
  # the whole of the document by definition.
  defp from_last_compaction(query, id) do
    case Repo.one(
           from(u in Update,
             where: u.workspace_id == ^id and u.compacted,
             order_by: [desc: u.id],
             limit: 1,
             select: u.id
           )
         ) do
      nil -> query
      at -> from(u in query, where: u.id >= ^at)
    end
  end

  @doc """
  Append a change to a workspace, and record the row count that came with it.

  The count is the client's, since the server does not read the document. The
  workspace's `updated_at` moves with it, which is what orders a list of them.
  """
  def append(workspace = %Workspace{}, update, rows) when is_binary(update) do
    Repo.transaction(fn ->
      Repo.insert!(%Update{workspace_id: workspace.id, update: update})

      workspace
      |> changeset(%{"rows" => rows})
      |> Ecto.Changeset.force_change(:updated_at, NaiveDateTime.utc_now(:second))
      |> Repo.update!()
    end)
  end

  @doc """
  Replace a workspace's updates with one that means the same thing.

  The merged update is the caller's: only a client reads the document, so only a
  client can merge it. Everything it stands for is deleted in the same
  transaction, so a reader never sees the two together.
  """
  def compact(workspace = %Workspace{}, merged) when is_binary(merged) do
    Repo.transaction(fn ->
      Repo.delete_all(from(u in Update, where: u.workspace_id == ^workspace.id))
      Repo.insert!(%Update{workspace_id: workspace.id, update: merged, compacted: true})
    end)
  end

  @doc """
  Let someone else open this workspace. Only its owner may say so.
  """
  def add_member(workspace = %Workspace{}, user_id, actor_id) do
    if workspace.owner_id == actor_id do
      %Member{workspace_id: workspace.id, user_id: user_id}
      |> Ecto.Changeset.change()
      |> Ecto.Changeset.unique_constraint([:workspace_id, :user_id])
      |> Repo.insert(on_conflict: :nothing)
      |> case do
        {:ok, _member} -> :ok
        {:error, _changeset} -> {:error, :invalid}
      end
    else
      {:error, :forbidden}
    end
  end

  @doc "Who may open this workspace, besides its owner."
  def members(%Workspace{id: id}) do
    from(m in Member,
      join: u in User,
      on: u.id == m.user_id,
      where: m.workspace_id == ^id,
      select: %{id: u.id, email: u.email}
    )
    |> Repo.all()
  end

  # Whether this person may open it: its owner, or someone let in.
  defp allows?(%Workspace{id: id, owner_id: owner_id}, user_id) do
    owner_id == user_id or
      Repo.exists?(from(m in Member, where: m.workspace_id == ^id and m.user_id == ^user_id))
  end
end
