defmodule RichardBurton.Repo.Migrations.RecordAMergeAsOneEntry do
  use Ecto.Migration

  @moduledoc """
  Let one history entry own a whole merge.

  A merge changes several publications at once — the one that survives absorbs
  what the others held, and they leave the database — but the log recorded that
  as a change to each of them separately, so nothing in it stood for the merge
  itself. Undoing it meant undoing one half.

  An entry now carries the records it absorbed, which is what makes the merge a
  single thing in the log: one entry to read, and one to undo.
  """

  def change do
    alter table(:publication_history) do
      # The publications this entry took in (a merge) or gave back (an
      # un-merge): each one's id and the state it was in, which is what putting
      # it back needs. Null for the entries that change one record only.
      add(:absorbed, :map)
    end
  end
end
