defmodule RichardBurton.Repo.Migrations.IndexTranslatorsForLikeness do
  use Ecto.Migration

  @moduledoc """
  What lets the duplicate review compare a record against a handful of others
  rather than against every other one.

  Two records are only ever candidates when their translators are alike, and
  trigram likeness cannot hold between strings that share no trigram — so the
  index cannot hide a pair the search would have kept. It narrows the field
  without narrowing the answer.
  """

  def up do
    execute("""
    CREATE INDEX flat_publications_translators_trigram_index
    ON flat_publications USING gin(authors gin_trgm_ops)
    """)
  end

  def down do
    execute("DROP INDEX flat_publications_translators_trigram_index")
  end
end
