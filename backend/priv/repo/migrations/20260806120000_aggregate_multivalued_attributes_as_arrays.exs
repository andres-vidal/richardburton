defmodule RichardBurton.Repo.Migrations.AggregateMultivaluedAttributesAsArrays do
  use Ecto.Migration

  @moduledoc """
  Hand the multi-valued attributes back as the lists they are.

  Countries, publishers, translators and original authors are several values,
  and the view joined each set into one comma-separated string. Every reader
  then split it again to count, compare or render the parts — the same parsing
  written once per reader, and a value containing a comma had nowhere to hide.

  They are arrays now, as `references` on this same view already was. The
  comma-joined form survives where it is actually a format rather than a
  representation: the CSV import and export, which is where it came from.

  The search document is built from these columns, so it joins them back with
  a space for the tsvector — a separator that is not part of any value.
  """

  def up do
    restack(
      flat_publications_select(&~s|array_agg(#{&1} ORDER BY #{&1})|),
      &~s|array_to_string(fp."#{&1}", ' ')|,
      "fp.countries"
    )
  end

  def down do
    restack(
      flat_publications_select(&~s|string_agg(#{&1}, ', ' ORDER BY #{&1})|),
      &~s|fp."#{&1}"|,
      "string_to_array(fp.countries, ', ')"
    )
  end

  # search_keywords reads search_documents, which reads flat_publications, so
  # the stack comes down top-first and is rebuilt bottom-first.
  #
  # `words` renders a multi-value column as the text the tsvector wants, and
  # `codes` renders the country codes as the array the name lookup matches on —
  # the two things the shape decides.
  defp restack(select, words, codes) do
    execute("DROP MATERIALIZED VIEW search_keywords")
    execute("DROP MATERIALIZED VIEW search_documents")
    execute("DROP MATERIALIZED VIEW flat_publications")

    execute("CREATE MATERIALIZED VIEW flat_publications AS #{select}")
    execute("CREATE UNIQUE INDEX flat_publications_id_index ON flat_publications (id)")
    execute("CREATE INDEX flat_publications_title_id_index ON flat_publications (title, id)")

    create_search_stack(words, codes)
  end

  # The countries are folded in by the names a reader searches them by, not by
  # their codes — as `IndexCountryNames` established.
  defp create_search_stack(words, codes) do
    execute("""
    CREATE MATERIALIZED VIEW search_documents AS
    SELECT
      fp.id,
      setweight(to_tsvector('rb_search'::regconfig, fp.title::text), 'A')                 ||
      setweight(to_tsvector('rb_search'::regconfig, fp.original_title::text), 'A')        ||
      setweight(to_tsvector('rb_search'::regconfig, #{words.("authors")}), 'B')           ||
      setweight(to_tsvector('rb_search'::regconfig, #{words.("original_authors")}), 'B')  ||
      setweight(to_tsvector('rb_search'::regconfig, #{words.("publishers")}), 'C')        ||
      setweight(to_tsvector('rb_search'::regconfig, coalesce(cn.names, '')), 'C')         ||
      setweight(to_tsvector('rb_search'::regconfig, fp.year::text), 'C')                  ||
      setweight(to_tsvector('rb_search'::regconfig, #{words.("references")}), 'D')        AS document
    FROM
      flat_publications fp
      LEFT JOIN LATERAL (
        SELECT string_agg(array_to_string(c.names, ' '), ' ') AS names
        FROM countries c
        WHERE c.code = ANY (#{codes})
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

  # The flattening join. Only how the four sets are folded differs between the
  # two shapes, so the body is written once and the fold is passed in.
  defp flat_publications_select(fold) do
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
      SELECT id, #{fold.("original_author")} AS original_authors
      FROM CTE_authors GROUP BY id
    ),
    CTE_translators AS (
      SELECT id, translator FROM CTE_publications GROUP BY id, translator
    ),
    CTE_translators_distinct AS (
      SELECT id, #{fold.("translator")} AS translators
      FROM CTE_translators GROUP BY id
    ),
    CTE_countries AS (
      SELECT id, country FROM CTE_publications GROUP BY id, country
    ),
    CTE_countries_distinct AS (
      SELECT id, #{fold.("country")} AS countries
      FROM CTE_countries GROUP BY id
    ),
    CTE_publishers AS (
      SELECT id, publisher FROM CTE_publications GROUP BY id, publisher
    ),
    CTE_publishers_distinct AS (
      SELECT id, #{fold.("publisher")} AS publishers
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
