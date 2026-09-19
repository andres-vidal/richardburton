defmodule RichardBurton.Repo.Migrations.RenameReferencesToSources do
  use Ecto.Migration

  @moduledoc """
  Rename the provenance entries behind a record from references to sources.

  They were references in the schema and sources on the screen. One word is
  enough, and it is the reader's: a source is what backs a claim, while a
  reference is as easily the citation's format as the thing itself.

  Everything is renamed in place rather than rebuilt. Postgres holds a view's
  definition and an index's expression against the columns themselves, not
  against their names, so both follow a rename on their own. Dropping the
  materialized views and writing them out again would mean restating every index
  on them, and any index added later and not added here would be lost.
  """

  def up, do: rename_to("sources", from: "references")

  def down, do: rename_to("references", from: "sources")

  defp rename_to(new, from: old) do
    execute("ALTER TABLE publication_#{old} RENAME TO publication_#{new}")
    execute("ALTER SEQUENCE publication_#{old}_id_seq RENAME TO publication_#{new}_id_seq")
    execute("ALTER INDEX publication_#{old}_pkey RENAME TO publication_#{new}_pkey")

    execute("""
    ALTER INDEX publication_#{old}_publication_id_index
    RENAME TO publication_#{new}_publication_id_index
    """)

    execute("""
    ALTER TABLE publication_#{new}
    RENAME CONSTRAINT publication_#{old}_publication_id_fkey
    TO publication_#{new}_publication_id_fkey
    """)

    # The flattened view folds the entries into one column, which the search
    # document and the operator index are both built from.
    execute("ALTER MATERIALIZED VIEW flat_publications RENAME COLUMN \"#{old}\" TO \"#{new}\"")

    execute("""
    ALTER INDEX flat_publications_#{old}_search_index
    RENAME TO flat_publications_#{new}_search_index
    """)
  end
end
