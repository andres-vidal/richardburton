defmodule RichardBurton.Repo.Migrations.WeighAndFoldTheSearchIndex do
  use Ecto.Migration

  @moduledoc """
  Improves the search index in three ways:

    - fields carry weights, so a match on the title outranks a match on the year;
    - the `rb_search` configuration folds accents, so a word is found whether or
      not the search typed its accents;
    - a publication's references join the search document at the lowest weight,
      so a search can match on them without their outranking the record's own
      fields.
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
