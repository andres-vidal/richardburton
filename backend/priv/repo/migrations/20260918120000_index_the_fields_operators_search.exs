defmodule RichardBurton.Repo.Migrations.IndexTheFieldsOperatorsSearch do
  use Ecto.Migration

  @moduledoc """
  Index each column an operator searches, so that a scoped search reads only the
  rows it matches.

  A free word is matched against `search_documents.document`, which is indexed.
  An operator is matched against a single column of `flat_publications`, and
  those columns had no index for it: `title:casmurro` read every row and built a
  tsvector for each one as it went. The cost of a scoped search grew with the
  size of the collection rather than with the size of its answer.

  The index expression has to be written exactly as the query writes it, or the
  planner will not use it. Each one below is the left-hand side of the predicate
  `RichardBurton.Publication.Index.Query` builds for that field.

  `references` is a list of strings that the search treats as one string, joined
  by spaces. `array_to_string` is not immutable, so Postgres refuses it in an
  index expression, and the join goes through `rb_joined/1` instead. Joining an
  array of strings does not depend on anything outside its argument, so the
  function is immutable in fact as well as in its declaration. The query calls it
  by the same name.

  Every index here is rebuilt whenever the refresher rebuilds the view, which
  makes a write slower in exchange for the reads.
  """

  # The columns an operator names, each matched as text through the `rb_search`
  # configuration.
  @text_fields [:title, :original_title, :authors, :original_authors, :publishers, :countries]

  def up do
    execute("""
    CREATE FUNCTION rb_joined(varchar[]) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    AS $$ SELECT array_to_string($1, ' ') $$
    """)

    for field <- @text_fields do
      execute("""
      CREATE INDEX flat_publications_#{field}_search_index ON flat_publications
      USING gin (to_tsvector('rb_search', coalesce(#{field}::text, '')))
      """)
    end

    execute("""
    CREATE INDEX flat_publications_references_search_index ON flat_publications
    USING gin (to_tsvector('rb_search', rb_joined("references")))
    """)

    # `year` is compared as a number against a range, rather than matched as text.
    execute("CREATE INDEX flat_publications_year_index ON flat_publications (year)")
  end

  def down do
    execute("DROP INDEX flat_publications_year_index")
    execute("DROP INDEX flat_publications_references_search_index")

    for field <- @text_fields do
      execute("DROP INDEX flat_publications_#{field}_search_index")
    end

    execute("DROP FUNCTION rb_joined(varchar[])")
  end
end
