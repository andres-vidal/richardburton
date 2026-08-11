defmodule RichardBurton.Repo.Migrations.CallReferencesSources do
  use Ecto.Migration

  @moduledoc """
  Call the provenance entries behind a record what the platform calls them.

  They were references in the schema and sources on the screen. One word is
  enough, and it is the reader's: a source is what backs a claim, while a
  reference is as easily the citation's format as the thing itself.

  The stack that reads the column comes down and is rebuilt, since a view
  remembers the name it selected under.
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

    restack(new)
  end

  # search_keywords reads search_documents, which reads flat_publications, so the
  # stack comes down top-first and is rebuilt bottom-first.
  defp restack(column) do
    execute("DROP MATERIALIZED VIEW search_keywords")
    execute("DROP MATERIALIZED VIEW search_documents")
    execute("DROP MATERIALIZED VIEW flat_publications")

    execute("CREATE MATERIALIZED VIEW flat_publications AS #{flat_publications_select(column)}")
    execute("CREATE UNIQUE INDEX flat_publications_id_index ON flat_publications (id)")
    execute("CREATE INDEX flat_publications_title_id_index ON flat_publications (title, id)")

    execute("""
    CREATE INDEX flat_publications_translators_trigram_index
    ON flat_publications USING gin(authors gin_trgm_ops)
    """)

    create_search_stack(column)
  end

  # The countries are folded in by the names a reader searches them by, not by
  # their codes — as `IndexCountryNames` established.
  defp create_search_stack(column) do
    execute("""
    CREATE MATERIALIZED VIEW search_documents AS
    SELECT
      fp.id,
      setweight(to_tsvector('rb_search'::regconfig, fp.title::text), 'A')                 ||
      setweight(to_tsvector('rb_search'::regconfig, fp.original_title::text), 'A')        ||
      setweight(to_tsvector('rb_search'::regconfig, fp.authors), 'B')                     ||
      setweight(to_tsvector('rb_search'::regconfig, fp.original_authors), 'B')            ||
      setweight(to_tsvector('rb_search'::regconfig, fp.publishers), 'C')                  ||
      setweight(to_tsvector('rb_search'::regconfig, coalesce(cn.names, '')), 'C')         ||
      setweight(to_tsvector('rb_search'::regconfig, fp.year::text), 'C')                  ||
      setweight(to_tsvector('rb_search'::regconfig,
        array_to_string(fp."#{column}", ' ')), 'D')                                       AS document
    FROM
      flat_publications fp
      LEFT JOIN LATERAL (
        SELECT string_agg(array_to_string(c.names, ' '), ' ') AS names
        FROM countries c
        WHERE c.code = ANY (string_to_array(fp.countries, ', '))
      ) cn ON true
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

  # The flattening join, exactly as the stack below it held it. Only the name of
  # the folded column and the table it is folded from differ between the two.
  defp flat_publications_select(column) do
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
    CTE_#{column}_distinct AS (
      SELECT publication_id AS id, array_agg(content ORDER BY "position") AS folded
      FROM publication_#{column} GROUP BY publication_id
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
      COALESCE(CTE_#{column}_distinct.folded, ARRAY[]::varchar[]) AS "#{column}"
    FROM CTE_publications
    INNER JOIN CTE_authors_distinct ON CTE_publications.id = CTE_authors_distinct.id
    INNER JOIN CTE_translators_distinct ON CTE_publications.id = CTE_translators_distinct.id
    INNER JOIN CTE_countries_distinct ON CTE_publications.id = CTE_countries_distinct.id
    INNER JOIN CTE_publishers_distinct ON CTE_publications.id = CTE_publishers_distinct.id
    LEFT JOIN CTE_#{column}_distinct ON CTE_publications.id = CTE_#{column}_distinct.id
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
      CTE_#{column}_distinct.folded
    """
  end
end
