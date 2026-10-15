defmodule RichardBurton.Repo.Migrations.AddNotesToPublications do
  @moduledoc """
  Adds `notes` to publications: free text about the publication, written
  as Markdown, or NULL when it has none. The `flat_publications` view carries
  it too.

  Postgres cannot add a column to a materialized view, so `up` drops the view
  stack and builds it again with the column, and `down` builds it again
  without the column before dropping it. The search documents and the search
  keywords are built as `ComputeFingerprintsInTheDatabase` left them, so the
  search does not read the notes.
  """

  use Ecto.Migration

  def up do
    alter table(:publications) do
      add(:notes, :text)
    end

    drop_views()
    create_views(flat_publications_select(notes: true))
  end

  def down do
    drop_views()
    create_views(flat_publications_select(notes: false))

    alter table(:publications) do
      remove(:notes)
    end
  end

  # search_keywords reads search_documents, which reads flat_publications, so
  # the stack comes down top-first and is rebuilt bottom-first.
  defp drop_views do
    execute("DROP MATERIALIZED VIEW search_keywords")
    execute("DROP MATERIALIZED VIEW search_documents")
    execute("DROP MATERIALIZED VIEW flat_publications")
  end

  # Builds the view stack and its indexes as `ComputeFingerprintsInTheDatabase`
  # did, with `select` as the query of `flat_publications`. Each view keeps its
  # unique index, which a CONCURRENTLY refresh needs.
  defp create_views(select) do
    execute("CREATE MATERIALIZED VIEW flat_publications AS #{select}")
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
    USING gin (to_tsvector('rb_search', rb_joined(sources)))
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
    SELECT word FROM ts_stat('SELECT document FROM search_documents')
    """)

    execute("CREATE INDEX search_trigram_index ON search_keywords USING gin(word gin_trgm_ops)")
    execute("CREATE UNIQUE INDEX search_keywords_word_index ON search_keywords (word)")
  end

  # The flattening join, with each set gathered into a sorted array. With
  # `notes: true` it also carries `publications.notes`.
  defp flat_publications_select(notes: notes) do
    carried = fn column -> if notes, do: column, else: "" end

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
          #{carried.("publications.notes AS notes,")}
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
      SELECT publication_id AS id, array_agg(content ORDER BY "position") AS refs
      FROM publication_sources GROUP BY publication_id
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
      #{carried.("CTE_publications.notes AS notes,")}
      COALESCE(CTE_sources_distinct.refs, ARRAY[]::varchar[]) AS sources
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
      #{carried.("CTE_publications.notes,")}
      CTE_authors_distinct.original_authors,
      CTE_translators_distinct.translators,
      CTE_countries_distinct.countries,
      CTE_publishers_distinct.publishers,
      CTE_sources_distinct.refs
    """
  end
end
