defmodule RichardBurton.Repo.Migrations.HoldImportDocuments do
  use Ecto.Migration

  @moduledoc """
  Where the rows being prepared for the database live between sittings.

  A document is one batch of import work under a name — a second pass over the
  1960s, a publisher's backlist — and the list of them is shared. There is no
  owner and no membership: the database being prepared is one database, and
  everyone keeping it is working towards the same thing, so anyone who may edit
  publications may open any document.

  A document's content is a Yjs document, and a Yjs document is a set of updates
  that can be applied in any order and more than once. So the server appends
  them and hands them back; it never parses one. That is what keeps a
  precompiled native dependency out of the deployment, and it costs only this: a
  row count cannot be computed here, so the client writes one when it writes.

  `rows` is that denormalised count. It is what the list shows, and it is the
  client's word rather than the server's.

  Updates accumulate, so a long-lived document would load a year of keystrokes.
  A client can write one merged update in place of the rows before it, which
  are deleted in the same transaction. The merge is an ordinary row once
  written, so nothing here marks it.
  """

  def change do
    create table(:documents) do
      add(:name, :string, null: false)
      add(:rows, :integer, null: false, default: 0)

      timestamps()
    end

    create table(:document_updates) do
      add(:document_id, references(:documents, on_delete: :delete_all), null: false)
      add(:update, :binary, null: false)

      timestamps(updated_at: false)
    end

    # Reading a document means reading its updates in the order they were
    # written, which is what this index serves.
    create(index(:document_updates, [:document_id, :id]))
  end
end
