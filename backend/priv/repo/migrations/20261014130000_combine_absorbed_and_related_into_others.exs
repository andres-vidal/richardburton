defmodule RichardBurton.Repo.Migrations.CombineAbsorbedAndRelatedIntoOthers do
  @moduledoc """
  Replaces the `absorbed` and `related` columns of the publication history
  with one column, `others`. It holds the other publications an entry is
  about, as a map from each one's id to its snapshot at the time. The entry's
  action says how they are involved: a merge took them in, an un-merge gave
  them back, and a duplicate decision is about them. See
  `RichardBurton.Publication.History`.

  The two columns had the same shape, and no entry filled both, so the action
  alone tells the two meanings apart.

  `up` renames `absorbed` to `others`, copies `related` into `others` on the
  decision entries, and drops `related`. `down` adds `related` back, moves the
  decision entries' `others` into it, and renames `others` to `absorbed`.

  The trigger `publication_history_append_only` rejects every UPDATE on the
  table, so each direction disables it for the statement that moves the data,
  and enables it again in the same transaction.
  """

  use Ecto.Migration

  @decisions "('distinguished', 'reconsidered')"

  def up do
    rename(table(:publication_history), :absorbed, to: :others)

    unguarded("""
    UPDATE publication_history SET others = related WHERE related IS NOT NULL
    """)

    alter table(:publication_history) do
      remove(:related)
    end
  end

  def down do
    alter table(:publication_history) do
      add(:related, :map)
    end

    unguarded("""
    UPDATE publication_history SET related = others, others = NULL
    WHERE action IN #{@decisions}
    """)

    rename(table(:publication_history), :others, to: :absorbed)
  end

  # Runs `sql` with the trigger `publication_history_append_only` disabled,
  # and enables the trigger again after it.
  defp unguarded(sql) do
    execute("ALTER TABLE publication_history DISABLE TRIGGER publication_history_append_only")
    execute(sql)
    execute("ALTER TABLE publication_history ENABLE TRIGGER publication_history_append_only")
  end
end
