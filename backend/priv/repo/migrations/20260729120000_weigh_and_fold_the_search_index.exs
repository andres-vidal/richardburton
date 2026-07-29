defmodule RichardBurton.Repo.Migrations.WeighAndFoldTheSearchIndex do
  use Ecto.Migration

  @moduledoc """
  Three things the index could not do: tell a title from a year, find a word
  written with its accents when it was asked for without them, and answer for a
  publication's sources at all.

  Fields carry weights now, `rb_search` folds accents on both sides of a search,
  and the references join the document at the lowest weight — searchable, but
  never outranking what the record itself says.
  """

  def up do
    execute("CREATE EXTENSION IF NOT EXISTS unaccent")

    execute("CREATE TEXT SEARCH CONFIGURATION rb_search (COPY = simple)")

    execute("""
    ALTER TEXT SEARCH CONFIGURATION rb_search
    ALTER MAPPING FOR hword, hword_part, word
    WITH unaccent, simple
    """)

    # search_keywords reads search_documents, so it goes first and comes back last.
    execute("DROP MATERIALIZED VIEW search_keywords")
    execute("DROP MATERIALIZED VIEW search_documents")

    execute("""
    CREATE MATERIALIZED VIEW search_documents AS
    SELECT
      id,
      setweight(to_tsvector('rb_search'::regconfig, title::text), 'A')                    ||
      setweight(to_tsvector('rb_search'::regconfig, original_title::text), 'A')           ||
      setweight(to_tsvector('rb_search'::regconfig, authors), 'B')                        ||
      setweight(to_tsvector('rb_search'::regconfig, original_authors), 'B')               ||
      setweight(to_tsvector('rb_search'::regconfig, publishers), 'C')                     ||
      setweight(to_tsvector('rb_search'::regconfig, countries), 'C')                      ||
      setweight(to_tsvector('rb_search'::regconfig, year::text), 'C')                     ||
      setweight(to_tsvector('rb_search'::regconfig,
        array_to_string("references", ' ')), 'D')                                         AS document
    FROM
      flat_publications
    """)

    execute("CREATE INDEX search_index ON search_documents USING gin(document)")
    execute("CREATE UNIQUE INDEX search_documents_id_index ON search_documents (id)")

    execute("""
    CREATE MATERIALIZED VIEW search_keywords AS
    SELECT word FROM ts_stat('SELECT document FROM search_documents')
    """)

    execute("CREATE INDEX search_trigram_index ON search_keywords USING gin(word gin_trgm_ops)")
    execute("CREATE UNIQUE INDEX search_keywords_word_index ON search_keywords (word)")
  end

  def down do
    execute("DROP MATERIALIZED VIEW search_keywords")
    execute("DROP MATERIALIZED VIEW search_documents")

    execute("""
    CREATE MATERIALIZED VIEW search_documents AS
    SELECT
      id,
      to_tsvector('simple'::regconfig, title::text)          ||
      to_tsvector('simple'::regconfig, countries)            ||
      to_tsvector('simple'::regconfig, publishers)           ||
      to_tsvector('simple'::regconfig, year::text)           ||
      to_tsvector('simple'::regconfig, authors)              ||
      to_tsvector('simple'::regconfig, original_title::text) ||
      to_tsvector('simple'::regconfig, original_authors)     AS document
    FROM
      flat_publications
    """)

    execute("CREATE INDEX search_index ON search_documents USING gin(document)")
    execute("CREATE UNIQUE INDEX search_documents_id_index ON search_documents (id)")

    execute("""
    CREATE MATERIALIZED VIEW search_keywords AS
    SELECT word FROM ts_stat('SELECT document FROM search_documents')
    """)

    execute("CREATE INDEX search_trigram_index ON search_keywords USING gin(word gin_trgm_ops)")
    execute("CREATE UNIQUE INDEX search_keywords_word_index ON search_keywords (word)")

    execute("DROP TEXT SEARCH CONFIGURATION rb_search")
  end
end
