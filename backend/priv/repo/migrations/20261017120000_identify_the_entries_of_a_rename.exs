defmodule RichardBurton.Repo.Migrations.IdentifyTheEntriesOfARename do
  @moduledoc """
  Adds `rename_id` to the publication history. It holds the id that the
  `"renamed"` entries of one rename share, and no other rename's entries have.
  It is NULL on the entries of every other action. See
  `RichardBurton.Publication.History`.

  `up` also gives an id to the `"renamed"` entries recorded before this
  migration. One rename inserted its entries in one statement, under one actor
  and with one `inserted_at`, so the entries that share both get the same id:
  the MD5 hash of the two, read as a UUID.

  The trigger `publication_history_append_only` rejects every UPDATE on the
  table, so `up` disables it for the statement that sets the ids, and enables
  it again in the same transaction.

  The partial index on `rename_id` serves the lookup of the other entries of a
  rename.
  """

  use Ecto.Migration

  def up do
    alter table(:publication_history) do
      add(:rename_id, :uuid)
    end

    create(index(:publication_history, [:rename_id], where: "rename_id IS NOT NULL"))

    execute("ALTER TABLE publication_history DISABLE TRIGGER publication_history_append_only")

    execute("""
    UPDATE publication_history
    SET rename_id = md5(actor || ' ' || inserted_at::text)::uuid
    WHERE action = 'renamed'
    """)

    execute("ALTER TABLE publication_history ENABLE TRIGGER publication_history_append_only")
  end

  def down do
    alter table(:publication_history) do
      remove(:rename_id)
    end
  end
end
