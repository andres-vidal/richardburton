defmodule RichardBurton.Repo.Migrations.WriteNotesAndSourcesInTwoLanguages do
  @moduledoc """
  Gives a publication's notes and each of its sources a Portuguese and an
  English text.

  `publications.notes` becomes `notes_pt`, and `notes_en` is added beside it.
  `publication_sources.content` becomes `content_pt`, and `content_en` is
  added beside it. Either text of a source may be NULL, but a check constraint
  requires each source to have text in at least one of the two. The existing
  notes and sources keep their text, now as the Portuguese one.

  `flat_publications` reads the renamed column, so the stack of materialized
  views is rebuilt. The view now holds a publication's sources three ways:
  `sources`, a JSON array of `{"pt": text, "en": text}` objects in position
  order, and `sources_pt` and `sources_en`, the texts of each language in the
  same order, with NULL where a source has no text in that language. The
  search reads the texts of both languages, so `search_documents` and the
  index behind the `source:` operator are built from `sources_pt || sources_en`.

  Rolling back keeps a source or a publication whose text is only in English
  by moving that text to the Portuguese column before the English one is
  dropped.
  """
  use Ecto.Migration

  def up do
    drop_views()

    execute("ALTER TABLE publications RENAME COLUMN notes TO notes_pt")
    execute("ALTER TABLE publications ADD COLUMN notes_en jsonb")

    execute("ALTER TABLE publication_sources RENAME COLUMN content TO content_pt")
    execute("ALTER TABLE publication_sources ALTER COLUMN content_pt DROP NOT NULL")
    execute("ALTER TABLE publication_sources ADD COLUMN content_en text")

    execute("""
    ALTER TABLE publication_sources ADD CONSTRAINT publication_sources_have_text
    CHECK (coalesce(content_pt, '') ~ '\\S' OR coalesce(content_en, '') ~ '\\S')
    """)

    create_views(:two_languages)
  end

  def down do
    drop_views()

    execute("""
    UPDATE publication_sources SET content_pt = content_en
    WHERE coalesce(content_pt, '') !~ '\\S'
    """)

    execute("ALTER TABLE publication_sources DROP CONSTRAINT publication_sources_have_text")
    execute("ALTER TABLE publication_sources DROP COLUMN content_en")
    execute("ALTER TABLE publication_sources ALTER COLUMN content_pt SET NOT NULL")
    execute("ALTER TABLE publication_sources RENAME COLUMN content_pt TO content")

    execute("UPDATE publications SET notes_pt = notes_en WHERE notes_pt IS NULL")
    execute("ALTER TABLE publications DROP COLUMN notes_en")
    execute("ALTER TABLE publications RENAME COLUMN notes_pt TO notes")

    create_views(:one_language)
  end

  # search_keywords reads search_documents, which reads flat_publications, so
  # the stack comes down top-first and is rebuilt bottom-first.
  defp drop_views do
    execute("DROP MATERIALIZED VIEW search_keywords")
    execute("DROP MATERIALIZED VIEW search_documents")
    execute("DROP MATERIALIZED VIEW flat_publications")
  end

  # Builds the stack of views and their indexes as
  # `ComputeFingerprintsInTheDatabase` left it, with the sources this
  # migration's `languages` hold: `:two_languages` as the module doc describes,
  # or `:one_language`, the single `sources` array of the `content` column.
  defp create_views(languages) do
    texts = source_texts(languages)

    execute(
      "CREATE MATERIALIZED VIEW flat_publications AS #{flat_publications_select(languages)}"
    )

    execute("CREATE UNIQUE INDEX flat_publications_id_index ON flat_publications (id)")
    execute("CREATE INDEX flat_publications_title_id_index ON flat_publications (title, id)")

    execute("""
    CREATE INDEX flat_publications_translators_trigram_index
    ON flat_publications USING gin((rb_joined(authors)) gin_trgm_ops)
    """)

    for field <- ~w(title original_title) do
      execute("""
      CREATE INDEX flat_publications_#{field}_search_index ON flat_publications
      USING gin (to_tsvector('rb_search', coalesce(#{field}::text, '')))
      """)
    end

    for field <- ~w(authors original_authors publishers countries) do
      execute("""
      CREATE INDEX flat_publications_#{field}_search_index ON flat_publications
      USING gin (to_tsvector('rb_search', rb_joined(#{field})))
      """)
    end

    execute("""
    CREATE INDEX flat_publications_sources_search_index ON flat_publications
    USING gin (to_tsvector('rb_search', rb_joined(#{texts})))
    """)

    execute("CREATE INDEX flat_publications_year_index ON flat_publications (year)")

    execute("""
    CREATE MATERIALIZED VIEW search_documents AS
    SELECT
      fp.id,
      setweight(to_tsvector('rb_search'::regconfig, fp.title::text), 'A')                     ||
      setweight(to_tsvector('rb_search'::regconfig, fp.original_title::text), 'A')            ||
      setweight(to_tsvector('rb_search'::regconfig, rb_joined(fp."authors")), 'B')           ||
      setweight(to_tsvector('rb_search'::regconfig, rb_joined(fp."original_authors")), 'B')  ||
      setweight(to_tsvector('rb_search'::regconfig, rb_joined(fp."publishers")), 'C')        ||
      setweight(to_tsvector('rb_search'::regconfig, coalesce(cn.names, '')), 'C')             ||
      setweight(to_tsvector('rb_search'::regconfig, fp.year::text), 'C')                      ||
      setweight(to_tsvector('rb_search'::regconfig,
        rb_joined(#{String.replace(texts, "sources", "fp.sources")})), 'D')  AS document
    FROM
      flat_publications fp
      LEFT JOIN LATERAL (
        SELECT string_agg(array_to_string(c.names, ' '), ' ') AS names
        FROM countries c
        WHERE c.code = ANY (fp.countries)
      ) cn ON true
    """)

    execute("CREATE INDEX search_index ON search_documents USING gin(document)")
    execute("CREATE UNIQUE INDEX search_documents_id_index ON search_documents (id)")

    execute("""
    CREATE MATERIALIZED VIEW search_keywords AS
    SELECT word FROM ts_stat('SELECT document FROM public.search_documents')
    """)

    execute("CREATE INDEX search_trigram_index ON search_keywords USING gin(word gin_trgm_ops)")
    execute("CREATE UNIQUE INDEX search_keywords_word_index ON search_keywords (word)")
  end

  # The array of every source text the search reads, as an expression over the
  # columns of `flat_publications`.
  defp source_texts(:two_languages), do: "sources_pt || sources_en"
  defp source_texts(:one_language), do: "sources"

  # The columns the view holds the sources in, and the aggregate of
  # `publication_sources` that fills them, for `languages`.
  defp sources_columns(:two_languages) do
    {
      """
      COALESCE(CTE_sources_distinct.pairs, '[]'::jsonb) AS sources,
      COALESCE(CTE_sources_distinct.texts_pt, ARRAY[]::varchar[]) AS sources_pt,
      COALESCE(CTE_sources_distinct.texts_en, ARRAY[]::varchar[]) AS sources_en
      """,
      """
      SELECT
        publication_id AS id,
        jsonb_agg(jsonb_build_object('pt', content_pt, 'en', content_en) ORDER BY "position") AS pairs,
        array_agg(content_pt ORDER BY "position")::varchar[] AS texts_pt,
        array_agg(content_en ORDER BY "position")::varchar[] AS texts_en
      FROM publication_sources GROUP BY publication_id
      """,
      "CTE_sources_distinct.pairs, CTE_sources_distinct.texts_pt, CTE_sources_distinct.texts_en"
    }
  end

  defp sources_columns(:one_language) do
    {
      "COALESCE(CTE_sources_distinct.refs, ARRAY[]::varchar[]) AS sources",
      """
      SELECT publication_id AS id, array_agg(content ORDER BY "position") AS refs
      FROM publication_sources GROUP BY publication_id
      """,
      "CTE_sources_distinct.refs"
    }
  end

  # The flattening join, with each set gathered into a sorted array and the
  # sources as `sources_columns/1` gives them for `languages`.
  defp flat_publications_select(languages) do
    {columns, aggregate, grouped} = sources_columns(languages)

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
      SELECT id, array_agg(original_author ORDER BY original_author) AS original_authors
      FROM CTE_authors GROUP BY id
    ),
    CTE_translators AS (
      SELECT id, translator FROM CTE_publications GROUP BY id, translator
    ),
    CTE_translators_distinct AS (
      SELECT id, array_agg(translator ORDER BY translator) AS translators
      FROM CTE_translators GROUP BY id
    ),
    CTE_countries AS (
      SELECT id, country FROM CTE_publications GROUP BY id, country
    ),
    CTE_countries_distinct AS (
      SELECT id, array_agg(country ORDER BY country) AS countries
      FROM CTE_countries GROUP BY id
    ),
    CTE_publishers AS (
      SELECT id, publisher FROM CTE_publications GROUP BY id, publisher
    ),
    CTE_publishers_distinct AS (
      SELECT id, array_agg(publisher ORDER BY publisher) AS publishers
      FROM CTE_publishers GROUP BY id
    ),
    CTE_sources_distinct AS (
      #{aggregate}
    )
    SELECT
      CTE_publications.id AS id,
      CTE_publications.title AS title,
      CTE_countries_distinct.countries AS countries,
      CTE_publications.year AS year,
      CTE_publishers_distinct.publishers AS publishers,
      CTE_publications.original_title AS original_title,
      CTE_authors_distinct.original_authors AS original_authors,
      CTE_translators_distinct.translators AS authors,
      #{columns}
    FROM CTE_publications
    INNER JOIN CTE_authors_distinct ON CTE_publications.id = CTE_authors_distinct.id
    INNER JOIN CTE_translators_distinct ON CTE_publications.id = CTE_translators_distinct.id
    INNER JOIN CTE_countries_distinct ON CTE_publications.id = CTE_countries_distinct.id
    INNER JOIN CTE_publishers_distinct ON CTE_publications.id = CTE_publishers_distinct.id
    LEFT JOIN CTE_sources_distinct ON CTE_publications.id = CTE_sources_distinct.id
    GROUP BY
      CTE_publications.id,
      CTE_publications.title,
      CTE_publications.year,
      CTE_publications.original_title,
      CTE_authors_distinct.original_authors,
      CTE_translators_distinct.translators,
      CTE_countries_distinct.countries,
      CTE_publishers_distinct.publishers,
      #{grouped}
    """
  end
end
