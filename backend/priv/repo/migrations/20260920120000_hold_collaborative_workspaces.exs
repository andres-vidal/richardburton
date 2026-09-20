defmodule RichardBurton.Repo.Migrations.HoldCollaborativeWorkspaces do
  use Ecto.Migration

  @moduledoc """
  Where a bulk-import workspace lives between sittings, and who may open it.

  A workspace's content is a Yjs document, and a Yjs document is a set of
  updates that can be applied in any order and more than once. So the server
  appends them and hands them back; it never parses one. That is what keeps a
  precompiled native dependency out of the deployment, and it costs only this:
  a row count cannot be computed here, so the client writes one when it writes.

  `rows` is that denormalised count. It is what a list of workspaces shows, and
  it is the client's word rather than the server's.

  Updates accumulate, so a long-lived workspace would load a year of keystrokes.
  `compacted` marks the one row that replaces every update before it: a merged
  snapshot, written by whoever compacts, with the rows behind it deleted in the
  same transaction.
  """

  def change do
    create table(:workspaces) do
      add(:name, :string, null: false)
      add(:owner_id, references(:users, on_delete: :delete_all), null: false)
      add(:rows, :integer, null: false, default: 0)

      timestamps()
    end

    create(index(:workspaces, [:owner_id]))

    create table(:workspace_updates) do
      add(:workspace_id, references(:workspaces, on_delete: :delete_all), null: false)
      add(:update, :binary, null: false)
      add(:compacted, :boolean, null: false, default: false)

      timestamps(updated_at: false)
    end

    # Reading a workspace means reading its updates in the order they were
    # written, which is what this index serves.
    create(index(:workspace_updates, [:workspace_id, :id]))

    create table(:workspace_members) do
      add(:workspace_id, references(:workspaces, on_delete: :delete_all), null: false)
      add(:user_id, references(:users, on_delete: :delete_all), null: false)

      timestamps(updated_at: false)
    end

    create(unique_index(:workspace_members, [:workspace_id, :user_id]))
  end
end
