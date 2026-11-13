defmodule RichardBurton.Repo.Migrations.WriteNotesAndSourcesInTwoLanguages do
  @moduledoc """
  Gives a publication notes and sources in Portuguese and in English.

  `publications.notes` becomes `notes_pt`, and `notes_en` is added beside it.
  Each row of `publication_sources` gains a `language`, `pt` or `en`, and the
  existing sources become Portuguese. A publication's sources in one language
  are ordered by `position`, which counts from 0 in each language.

  The history is rewritten into the same shape. In each snapshot, the one in
  `snapshot` and each one in `others`, the `notes` key becomes `notes_pt` and
  `notes_en` is added as null, and the `sources` key becomes `sources_pt` and
  `sources_en` is added as an empty list. A snapshot without one of those keys
  keeps its other keys as they are. The trigger
  `publication_history_append_only` rejects every UPDATE on the table, so it
  is disabled for the statement that rewrites the snapshots, and enabled again
  in the same transaction.

  `flat_publications` holds the sources of each language in `sources_pt` and
  `sources_en`, and all of them in `sources`, the Portuguese sources followed
  by the English ones, which the search reads. The view reads the renamed
  notes column and the new `language` column, so the stack of materialized
  views is rebuilt.

  Rolling back puts each publication's English sources after its Portuguese
  ones, and uses its English notes where it has no Portuguese notes, in the
  tables and in the history, before the English columns and keys are dropped.
  """
  use Ecto.Migration

  def up do
    drop_views()

    execute("ALTER TABLE publications RENAME COLUMN notes TO notes_pt")
    execute("ALTER TABLE publications ADD COLUMN notes_en jsonb")

    execute("ALTER TABLE publication_sources ADD COLUMN language text NOT NULL DEFAULT 'pt'")
    execute("ALTER TABLE publication_sources ALTER COLUMN language DROP DEFAULT")

    execute("""
    ALTER TABLE publication_sources ADD CONSTRAINT publication_sources_language
    CHECK (language IN ('pt', 'en'))
    """)

    rewrite_history("""
    SELECT CASE
      WHEN s ? 'sources'
      THEN (s - 'sources') || jsonb_build_object('sources_pt', s -> 'sources', 'sources_en', '[]'::jsonb)
      ELSE s
    END
    FROM (
      SELECT CASE
        WHEN snapshot ? 'notes'
        THEN (snapshot - 'notes') || jsonb_build_object('notes_pt', snapshot -> 'notes', 'notes_en', NULL)
        ELSE snapshot
      END AS s
    ) AS with_notes
    """)

    create_views(:two_languages)
  end

  def down do
    drop_views()

    rewrite_history("""
    SELECT CASE
      WHEN s ? 'sources_pt' OR s ? 'sources_en'
      THEN (s - 'sources_pt' - 'sources_en') || jsonb_build_object(
        'sources',
        coalesce(s -> 'sources_pt', '[]'::jsonb) || coalesce(s -> 'sources_en', '[]'::jsonb)
      )
      ELSE s
    END
    FROM (
      SELECT CASE
        WHEN snapshot ? 'notes_pt' OR snapshot ? 'notes_en'
        THEN (snapshot - 'notes_pt' - 'notes_en') || jsonb_build_object(
          'notes',
          coalesce(nullif(snapshot -> 'notes_pt', 'null'::jsonb), snapshot -> 'notes_en')
        )
        ELSE snapshot
      END AS s
    ) AS with_notes
    """)

    execute("""
    UPDATE publication_sources AS en
    SET language = 'pt', position = en.position + (
      SELECT count(*) FROM publication_sources AS pt
      WHERE pt.publication_id = en.publication_id AND pt.language = 'pt'
    )
    WHERE en.language = 'en'
    """)

    execute("ALTER TABLE publication_sources DROP CONSTRAINT publication_sources_language")
    execute("ALTER TABLE publication_sources DROP COLUMN language")

    execute("UPDATE publications SET notes_pt = notes_en WHERE notes_pt IS NULL")
    execute("ALTER TABLE publications DROP COLUMN notes_en")
    execute("ALTER TABLE publications RENAME COLUMN notes_pt TO notes")

    create_views(:one_language)
  end

  # Rewrites every snapshot in the history, the one in `snapshot` and each one
  # in `others`, with `body`, a SQL query of one jsonb value that reads the
  # snapshot as `snapshot`. The query is run through a function that exists
  # only during the rewrite.
  defp rewrite_history(body) do
    execute("""
    CREATE FUNCTION rb_rewritten_snapshot(snapshot jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE AS $$ #{body} $$
    """)

    execute("ALTER TABLE publication_history DISABLE TRIGGER publication_history_append_only")

    execute("""
    UPDATE publication_history SET
      snapshot = rb_rewritten_snapshot(snapshot),
      others = CASE WHEN others IS NOT NULL THEN (
        SELECT coalesce(jsonb_object_agg(id, rb_rewritten_snapshot(other)), '{}'::jsonb)
        FROM jsonb_each(others) AS each(id, other)
      ) END
    """)

    execute("ALTER TABLE publication_history ENABLE TRIGGER publication_history_append_only")
    execute("DROP FUNCTION rb_rewritten_snapshot(jsonb)")
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

    for field <- ~w(authors original_authors publishers countries sources) do
      execute("""
      CREATE INDEX flat_publications_#{field}_search_index ON flat_publications
      USING gin (to_tsvector('rb_search', rb_joined(#{field})))
      """)
    end

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
        rb_joined(fp.sources)), 'D')                                          AS document
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

  # The columns the view holds the sources in, and the aggregate of
  # `publication_sources` that fills them, for `languages`. Both shapes have a
  # `sources` column, the one the search reads.
  defp sources_columns(:two_languages) do
    {
      """
      COALESCE(CTE_sources_distinct.texts_pt, ARRAY[]::varchar[]) AS sources_pt,
      COALESCE(CTE_sources_distinct.texts_en, ARRAY[]::varchar[]) AS sources_en,
      COALESCE(CTE_sources_distinct.texts_pt, ARRAY[]::varchar[]) ||
        COALESCE(CTE_sources_distinct.texts_en, ARRAY[]::varchar[]) AS sources
      """,
      """
      SELECT
        publication_id AS id,
        (array_agg(content ORDER BY "position") FILTER (WHERE language = 'pt'))::varchar[] AS texts_pt,
        (array_agg(content ORDER BY "position") FILTER (WHERE language = 'en'))::varchar[] AS texts_en
      FROM publication_sources GROUP BY publication_id
      """,
      "CTE_sources_distinct.texts_pt, CTE_sources_distinct.texts_en"
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
