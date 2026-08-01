defmodule RichardBurton.Repo.Migrations.MaterializeFlatPublications do
  use Ecto.Migration

  @moduledoc """
  Materialize the flattened publication.

  It was a plain view: its ten-way join and four aggregations were rebuilt on
  every read of the index, search and detail pages. Now it is a materialized
  view — the join is paid once, when the index refresher rebuilds it, and reads
  become index lookups (a unique id for point fetches and CONCURRENTLY refreshes,
  a (title, id) btree for the listing's order).

  The reader tolerates the staleness this introduces, the same window search has
  always had; the one consumer that needs the live truth — the conflict check on
  write — no longer reads this view. search_documents and search_keywords are
  stacked on top, so they come down before it and are rebuilt after.
  """

  def up do
    drop_stack()

    execute("CREATE MATERIALIZED VIEW flat_publications AS #{flat_publications_select()}")
    execute("CREATE UNIQUE INDEX flat_publications_id_index ON flat_publications (id)")
    execute("CREATE INDEX flat_publications_title_id_index ON flat_publications (title, id)")

    create_search_stack()
  end

  def down do
    execute("DROP MATERIALIZED VIEW search_keywords")
    execute("DROP MATERIALIZED VIEW search_documents")
    execute("DROP MATERIALIZED VIEW flat_publications")

    execute("CREATE VIEW flat_publications AS #{flat_publications_select()}")

    create_search_stack()
  end

  # search_keywords reads search_documents, which reads flat_publications, so the
  # stack comes down top-first.
  defp drop_stack do
    execute("DROP MATERIALIZED VIEW search_keywords")
    execute("DROP MATERIALIZED VIEW search_documents")
    execute("DROP VIEW flat_publications")
  end

  defp create_search_stack do
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

  # The flattening join, live-only, exactly as the view held it — reused as the
  # matview's body on the way up and restored to a plain view on the way down.
  defp flat_publications_select do
    """
    WITH
    CTE_publications AS (
      SELECT
          publications.id AS id,
          publications.title AS title,
          publications.year AS year,
          authors.name AS original_author,
          translators.name AS translator,
          original_books.title AS original_title,
          publications.translated_book_fingerprint AS translated_book_fingerprint,
          publications.countries_fingerprint AS countries_fingerprint,
          publications.publishers_fingerprint AS publishers_fingerprint,
          countries.code AS country,
          publishers.name AS publisher
      FROM translated_books
      INNER JOIN publications ON publications.translated_book_id = translated_books.id
      INNER JOIN original_books ON original_books.id = translated_books.original_book_id
      INNER JOIN original_book_authors ON original_book_authors.original_book_id = original_books.id
      INNER JOIN authors ON authors.id = original_book_authors.author_id
      INNER JOIN translated_book_authors ON translated_book_authors.translated_book_id = translated_books.id
      INNER JOIN authors AS translators ON translators.id = translated_book_authors.author_id
      INNER JOIN publication_countries ON publication_countries.publication_id = publications.id
      INNER JOIN countries ON countries.id = publication_countries.country_id
      INNER JOIN publication_publishers ON publication_publishers.publication_id = publications.id
      INNER JOIN publishers ON publishers.id = publication_publishers.publisher_id
      WHERE publications.deleted_at IS NULL
    ),
    CTE_authors AS (
      SELECT id, original_author FROM CTE_publications GROUP BY id, original_author
    ),
    CTE_authors_distinct AS (
      SELECT id, string_agg(original_author, ', ' ORDER BY original_author) AS original_authors
      FROM CTE_authors GROUP BY id
    ),
    CTE_translators AS (
      SELECT id, translator FROM CTE_publications GROUP BY id, translator
    ),
    CTE_translators_distinct AS (
      SELECT id, string_agg(translator, ', ' ORDER BY translator) AS translators
      FROM CTE_translators GROUP BY id
    ),
    CTE_countries AS (
      SELECT id, country FROM CTE_publications GROUP BY id, country
    ),
    CTE_countries_distinct AS (
      SELECT id, string_agg(country, ', ' ORDER BY country) AS countries
      FROM CTE_countries GROUP BY id
    ),
    CTE_publishers AS (
      SELECT id, publisher FROM CTE_publications GROUP BY id, publisher
    ),
    CTE_publishers_distinct AS (
      SELECT id, string_agg(publisher, ', ' ORDER BY publisher) AS publishers
      FROM CTE_publishers GROUP BY id
    ),
    CTE_references_distinct AS (
      SELECT publication_id AS id, array_agg(content ORDER BY "position") AS refs
      FROM publication_references GROUP BY publication_id
    )
    SELECT
      CTE_publications.id AS id,
      CTE_publications.title AS title,
      CTE_countries_distinct.countries AS countries,
      CTE_publications.countries_fingerprint AS countries_fingerprint,
      CTE_publications.year AS year,
      CTE_publishers_distinct.publishers AS publishers,
      CTE_publications.publishers_fingerprint AS publishers_fingerprint,
      CTE_publications.original_title AS original_title,
      CTE_authors_distinct.original_authors AS original_authors,
      CTE_translators_distinct.translators AS authors,
      CTE_publications.translated_book_fingerprint AS translated_book_fingerprint,
      COALESCE(CTE_references_distinct.refs, ARRAY[]::varchar[]) AS "references"
    FROM CTE_publications
    INNER JOIN CTE_authors_distinct ON CTE_publications.id = CTE_authors_distinct.id
    INNER JOIN CTE_translators_distinct ON CTE_publications.id = CTE_translators_distinct.id
    INNER JOIN CTE_countries_distinct ON CTE_publications.id = CTE_countries_distinct.id
    INNER JOIN CTE_publishers_distinct ON CTE_publications.id = CTE_publishers_distinct.id
    LEFT JOIN CTE_references_distinct ON CTE_publications.id = CTE_references_distinct.id
    GROUP BY
      CTE_publications.id,
      CTE_publications.title,
      CTE_publications.year,
      CTE_publications.original_title,
      CTE_publications.translated_book_fingerprint,
      CTE_publications.countries_fingerprint,
      CTE_publications.publishers_fingerprint,
      CTE_authors_distinct.original_authors,
      CTE_translators_distinct.translators,
      CTE_countries_distinct.countries,
      CTE_publishers_distinct.publishers,
      CTE_references_distinct.refs
    """
  end
end
