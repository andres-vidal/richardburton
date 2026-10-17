defmodule RichardBurton.Repo.Migrations.QualifyTheSearchKeywordsQuery do
  @moduledoc """
  Rebuilds `search_keywords` so that the query its `ts_stat` runs names its
  table with the schema, `public.search_documents`.

  `ts_stat` parses that query from its text each time the view is refreshed.
  Postgres 17 and later refresh materialized views with `search_path` set to
  `pg_catalog, pg_temp`, and a `pg_dump` restore sets it empty. Under either
  setting the bare name `search_documents` does not resolve, and the refresh
  fails.

  The earlier migrations that build `search_keywords` now use the qualified
  name too, so a database migrated from scratch has it already. This migration
  rebuilds the view in databases that were migrated before that change.
  """
  use Ecto.Migration

  def up do
    execute("DROP MATERIALIZED VIEW search_keywords")

    execute("""
    CREATE MATERIALIZED VIEW search_keywords AS
    SELECT word FROM ts_stat('SELECT document FROM public.search_documents')
    """)

    execute("CREATE INDEX search_trigram_index ON search_keywords USING gin(word gin_trgm_ops)")
    execute("CREATE UNIQUE INDEX search_keywords_word_index ON search_keywords (word)")
  end

  # Leaves the view as it is. The unqualified definition cannot be created on
  # Postgres 17 or later.
  def down, do: :ok
end
