defmodule RichardBurton.Repo.Migrations.BoundCompactionAndRetireDocuments do
  use Ecto.Migration

  @moduledoc """
  What a compaction stands for, and how a document stops being offered.

  A compaction used to be a flag, which said that a row replaced everything
  before it without saying where "before" ended. That is only true when nothing
  is being written while the merge is made, and a shared document is written to
  while it is open. `compacted_through` names the last update the merge actually
  covers, so anything appended past that point is kept and read alongside it.

  `archived_at` retires a document without destroying it. The work it holds is a
  record of what was prepared, and a list nobody can shorten is a list nobody
  reads.
  """

  def change do
    alter table(:documents) do
      add(:archived_at, :utc_datetime)
    end

    alter table(:document_updates) do
      add(:compacted_through, :bigint)
      remove(:compacted, :boolean, null: false, default: false)
    end

    # Finding what a read starts from means finding the furthest-reaching
    # compaction, which is what this serves.
    create(index(:document_updates, [:document_id, :compacted_through]))

    # The list shows what has not been retired, most recently changed first.
    create(index(:documents, [:archived_at, :updated_at]))
  end
end
