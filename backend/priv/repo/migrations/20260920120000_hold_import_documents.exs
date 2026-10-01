defmodule RichardBurton.Repo.Migrations.HoldImportDocuments do
  use Ecto.Migration

  @moduledoc """
  Creates `documents` and `document_updates`, which store import documents:
  rows being prepared for the database.

  A document is one named batch of import work, such as a second pass over the
  1960s or one publisher's backlist. The list of documents is shared. A
  document has no owner and no members, and anyone who may edit publications
  may open any document.

  A document's content is a Yjs document, which is a set of updates that can be
  applied in any order and more than once. The server only appends updates and
  returns them, and never parses one. This keeps a precompiled native
  dependency out of the deployment. It also means the server cannot count the
  rows in a document.

  `rows` is a denormalised row count, stored as given with each write. The
  server does not check it.

  Updates accumulate, so a long-lived document collects many of them. A caller
  can write one merged update in place of the updates before it, which are
  deleted in the same transaction. The merged update is an ordinary row, and
  nothing marks it as a merge.
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

    # Covers reading a document's updates in id order, which is the order they
    # were written.
    create(index(:document_updates, [:document_id, :id]))
  end
end
